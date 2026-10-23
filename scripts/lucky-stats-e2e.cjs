/* Reproducible UI test. All API/storage/analytics responses in this test are local fixtures. */
const { _electron } = require('playwright');
const { createServer } = require('node:http');
const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

async function main() {
  const parry = process.env.PLATFORM === 'parry';
  const setId = parry ? '01a0bc51-736d-761d-b6ed-042418c5cd14' : '12345678';
  const tournamentId = '01a0bc41-9f3b-70fa-8c35-500608f7dcab';
  const executablePath = process.env.ELECTRON_APP;
  assert.ok(executablePath, 'Set ELECTRON_APP to the packaged app executable.');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lucky-ui-'));
  const profile = path.join(root, 'profile');
  const folder = path.join(root, 'set');
  const shots = path.resolve(
    process.env.SHOTS || 'docs/lucky-stats/screenshots',
  );
  await Promise.all([
    fs.mkdir(profile),
    fs.mkdir(folder),
    fs.mkdir(shots, { recursive: true }),
  ]);
  await fs.writeFile(
    path.join(profile, 'config.json'),
    JSON.stringify({
      mode: 'manual',
      ...(parry ? { parryggApiKey: 'fixture-parry-key' } : {}),
      guidedMode: false,
      manualNames: ['Player One', 'Player Two'],
      useLAN: false,
    }),
  );
  await fs.writeFile(
    path.join(folder, 'context.json'),
    JSON.stringify({
      startgg: {
        event: { slug: 'tournament/integration-test-weekly/event/singles' },
        tournament: parry ? { parryId: tournamentId } : undefined,
        set: parry ? { id: null, internalId: setId } : { id: Number(setId) },
      },
      scores: [],
    }),
  );
  await fs.writeFile(path.join(folder, 'game.slp'), Buffer.alloc(4096, 1));
  const uploads = new Map();
  let finalized = false;
  let collectionVersion = 1;
  let finalizedBy = null;
  let polls = 0;
  let finishCalls = 0;
  let stored = 0;
  const batch = randomUUID();
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks);
      const route = req.url;
      if (req.method === 'PUT') {
        assert.equal(req.headers.authorization, undefined);
        assert.equal(req.headers['x-parry-api-key'], undefined);
        const [, id, index] = route.split('/');
        const upload = uploads.get(id);
        const file = upload.files[Number(index)];
        assert.equal(raw.length, file.size);
        assert.equal(
          createHash('sha256').update(raw).digest('hex'),
          file.sha256,
        );
        stored += 1;
        res.writeHead(200);
        res.end();
        return;
      }
      assert.match(req.headers.authorization, /^Bearer l7u_/);
      assert.equal(req.headers['x-app-id'], 'replay-reporter');
      const send = (data, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      const body = raw.length ? JSON.parse(raw) : {};
      if (route === '/connection') {
        send({ workflow: 'per_set_until_tournament_finished' });
        return;
      }
      if (route === '/uploads') {
        assert.equal(body.setId, setId);
        if (parry) {
          assert.equal(body.tournament, `parry:${tournamentId}`);
          assert.equal(req.headers['x-parry-api-key'], 'fixture-parry-key');
        }
        assert.equal(finalized, false);
        const id = req.headers['idempotency-key'];
        if (!uploads.has(id))
          uploads.set(id, { files: body.files, accepted: false });
        send({
          uploadId: id,
          tournamentUploadId: batch,
          status: 'awaiting_upload',
          files: body.files.map((f, i) => ({
            ...f,
            url: `https://e2e.amazonaws.com/${id}/${i}`,
            headers: {
              'Content-Length': String(f.size),
              'Content-Type': f.path.endsWith('.json')
                ? 'application/json'
                : 'application/octet-stream',
            },
          })),
        });
        return;
      }
      if (route.startsWith('/uploads/') && route.endsWith('/complete')) {
        uploads.get(route.split('/')[2]).accepted = true;
        send({ handoffAccepted: true, status: 'staged' });
        return;
      }
      if (route === `/tournaments/${batch}/reopen`) {
        assert.equal(body.collectionVersion, collectionVersion);
        finalized = false;
        finalizedBy = null;
        collectionVersion++;
        send({ status: 'collecting', collectionVersion });
        return;
      }
      if (route === `/tournaments/${batch}/complete`) {
        assert.equal(body.collectionVersion, collectionVersion);
        assert.ok([...uploads.values()].every((u) => u.accepted));
        finalized = true;
        finalizedBy = 'manual';
        polls = 0;
        finishCalls += 1;
        send({ status: 'submitted' });
        return;
      }
      if (route === `/tournaments/${batch}`) {
        if (finalized) polls += 1;
        const ready = polls >= 3;
        send({
          status: finalized ? 'submitted' : 'collecting',
          collectionVersion,
          finalizedBy,
          totalUploadedSets: 3,
          inFlightUploads: 0,
          contributions: [
            { keyPrefix: 'l7u_aaaaaaaa', uploadedSets: 1 },
            { keyPrefix: 'l7u_bbbbbbbb', uploadedSets: 2 },
          ],
          autoFinishIdleHours: 6,
          pollAfterSeconds: 15,
          imports:
            finishCalls || finalized
              ? [
                  {
                    importRunId: 'test-import',
                    import: {
                      phase: ready ? 'completed' : 'importing',
                      percent: ready ? 100 : 50,
                      importedSets: ready ? 1 : 0,
                      importedGames: ready ? 1 : 0,
                    },
                    analytics: {
                      state: ready ? 'ready' : 'processing',
                      percent: ready ? 100 : 0,
                      readySets: ready ? 1 : 0,
                      totalSets: 1,
                      coverageComplete: ready,
                    },
                    skipped: [],
                  },
                ]
              : [],
        });
        return;
      }
      send({ error: 'not_found' }, 404);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'fixture_assertion_failed' }));
      console.error(e);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  let app;
  async function launch() {
    app = await _electron.launch({
      executablePath,
      args: [`--user-data-dir=${profile}`],
      timeout: 60000,
    });
    await app.evaluate(
      ({ dialog }, { port, folder }) => {
        const realFetch = global.fetch;
        global.fetch = (url, opts) =>
          realFetch(
            String(url).replace(
              'https://luckystats.gg/api/integrations/v1',
              `http://127.0.0.1:${port}`,
            ),
            opts,
          );
        const https = process.mainModule.require('https');
        const original = https.request;
        https.request = (url, options, callback) =>
          new URL(url).hostname === 'e2e.amazonaws.com'
            ? process.mainModule
                .require('http')
                .request(
                  `http://127.0.0.1:${port}${new URL(url).pathname}`,
                  options,
                  callback,
                )
            : original(url, options, callback);
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [folder],
        });
      },
      { port, folder },
    );
    await app.firstWindow();
    let page;
    for (let i = 0; i < 50 && !page; i += 1) {
      page = app.windows().find((p) => p.url().endsWith('/index.html'));
      if (!page) await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(page);
    page.setDefaultTimeout(20000);
    // Upstream may auto-open Settings when a new app release is available.
    const settingsHeading = page.getByRole('heading', {
      name: 'Settings',
      exact: true,
    });
    await settingsHeading.waitFor({ timeout: 3000 }).catch(() => {});
    if (await settingsHeading.isVisible()) {
      await page.keyboard.press('Escape');
      await settingsHeading.waitFor({ state: 'hidden' });
    }
    try {
      await page.getByRole('button', { name: /^Lucky Stats$/i }).click();
    } catch (error) {
      console.log(await page.locator('body').innerText());
      await page.screenshot({ path: '/tmp/lucky-startup-failure.png' });
      throw error;
    }
    return page;
  }
  try {
    let page = await launch();
    await page.getByLabel('Upload key').fill(`l7u_${'a'.repeat(64)}`);
    await page.getByRole('button', { name: /^Connect$/i }).click();
    await page.getByText('Automatic uploads on', { exact: true }).waitFor();
    assert.equal(await page.getByRole('switch').count(), 0);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page
      .getByRole('switch', { name: 'Pause Lucky Stats uploads' })
      .click();
    await page.waitForFunction(
      async () => !(await window.electron.luckyStatus()).enabled,
    );
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(shots, 'fixture-upload-settings.png'),
    });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Lucky Stats$/i }).click();
    await page
      .getByText('Uploads paused. Resume in Settings → Lucky Stats.')
      .waitFor();
    // Queue while paused, then restart: no network handoff until explicitly enabled.
    await page
      .getByRole('button', { name: /Add existing set folder/i })
      .click();
    await page.getByText(`Set ${setId} · Queued`, { exact: true }).waitFor();
    assert.equal(uploads.size, 0);
    await app.close();
    app = undefined;
    page = await launch();
    await page.getByText(`Set ${setId} · Queued`, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page
      .getByRole('switch', { name: 'Pause Lucky Stats uploads' })
      .click();
    await page.waitForFunction(
      async () => (await window.electron.luckyStatus()).enabled,
    );
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Lucky Stats$/i }).click();
    await page
      .getByText(`Set ${setId} · Uploaded · waiting for tournament finish`, {
        exact: true,
      })
      .waitFor();
    assert.equal(finishCalls, 0);
    await fs.writeFile(path.join(folder, 'game.slp'), Buffer.alloc(8192, 2));
    await page
      .getByRole('button', { name: /Add existing set folder/i })
      .click();
    await page.getByText(`Set ${setId} · Replaced`, { exact: true }).waitFor();
    await page
      .getByText(`Set ${setId} · Uploaded · waiting for tournament finish`, {
        exact: true,
      })
      .waitFor();
    await page.getByRole('button', { name: /^Finish tournament$/i }).click();
    await page
      .getByRole('heading', { name: 'Finish tournament uploads?' })
      .waitFor();
    await page.waitForTimeout(500); // Let progress-bar transitions finish before capture.
    await page.screenshot({
      path: path.join(shots, 'fixture-finish-confirmation.png'),
    });
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: /^Finish tournament$/i })
      .click();
    await page.getByText(/Advanced analytics: Processing/).waitFor();
    await page.waitForTimeout(500); // Let progress-bar transitions finish before capture.
    await page.screenshot({ path: path.join(shots, 'fixture-processing.png') });
    await page
      .getByText(/Advanced analytics: Ready/)
      .waitFor({ timeout: 30000 });
    await page.waitForTimeout(500); // Let progress-bar transitions finish before capture.
    await page.screenshot({ path: path.join(shots, 'fixture-ready.png') });
    await page.getByText('l7u_bbbbbbbb… · 2 sets').waitFor();
    await page.screenshot({
      path: path.join(shots, 'fixture-contributors.png'),
    });
    // Another reporter reopens: this app must follow without any local action.
    finalized = false;
    finalizedBy = null;
    collectionVersion++;
    await page
      .getByText('Collecting sets', { exact: true })
      .waitFor({ timeout: 25000 });
    await page.screenshot({
      path: path.join(shots, 'fixture-remote-reopen.png'),
    });
    // The server's inactivity job finishes the same collection.
    finalized = true;
    finalizedBy = 'automatic';
    await page
      .getByText('Finished automatically', { exact: true })
      .waitFor({ timeout: 25000 });
    await page.screenshot({
      path: path.join(shots, 'fixture-auto-finished.png'),
    });
    await page
      .getByRole('button', { name: 'Reopen uploads', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Reopen uploads', exact: true })
      .click();
    await page.getByText('Collecting sets', { exact: true }).waitFor();
    assert.equal(collectionVersion, 3);
    // A remote manual finish must also be reflected after reopening.
    finalized = true;
    finalizedBy = 'manual';
    await page
      .getByText('Finished', { exact: true })
      .waitFor({ timeout: 25000 });
    assert.equal(finishCalls, 1);
    assert.equal(uploads.size, 2);
    assert.equal(stored, 4);
    console.log(
      'PASS: built Electron UI → connect → settings pause/resume → restart → upload/replacement → shared key counts → finish → remote reopen → automatic finish → local reopen → remote manual finish (local fixture server).',
    );
  } catch (error) {
    const failedPage = app
      ?.windows()
      .find((p) => p.url().endsWith('/index.html'));
    if (failedPage) {
      console.log(await failedPage.locator('body').innerText());
      await failedPage.screenshot({ path: '/tmp/lucky-settings-failure.png' });
    }
    throw error;
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
