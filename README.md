# Replay Manager for Slippi
Replay Manager for Slippi helps users integrate [Slippi replays](https://github.com/project-slippi/slippi-wiki/blob/master/SPEC.md) with [start.gg](https://www.start.gg/) or [challonge](https://challonge.com/) brackets.
It enables a workflow where Slippi replays are collected set-by-set, used to report set results (including character and stage data), and grouped/labelled for easier organization.
## Features
- Auto-detect USB drive
- "Safely Remove" USB drive on replay folder deletion
- Mark set started  
![Screenshot 2024-07-20 101744](https://github.com/user-attachments/assets/026bed5f-59a8-43f9-82b5-cdfdc88368c9)
- Report winner or DQ maually  
![Screenshot 2024-07-20 101736](https://github.com/user-attachments/assets/bd927d3d-26d6-48b4-82dd-663b957da014)  
![Screenshot 2024-07-20 101806](https://github.com/user-attachments/assets/6db64645-52be-4ba6-9c06-728913aa6f0d)
- 1-click report, copy, delete  
![Screenshot 2024-07-20 100937](https://github.com/user-attachments/assets/d6c2d916-4d82-4d84-8878-63f9731d7cbc)
- Batch set players  
![ezgif-2-173f6cddcc](https://github.com/user-attachments/assets/5df4f4af-9715-4141-b150-65d1a6f0a236)
- Set players per match if necessary  
![ezgif-2-ced60802c4](https://github.com/user-attachments/assets/ba0c6227-7d9b-49a7-90d5-160c37d000fb)
- Set winner  
![ezgif-7-a894f4189f](https://github.com/user-attachments/assets/423633af-74ca-47c3-872a-f96d24de076a)
- Override winner  
![ezgif-7-86d9cca68a](https://github.com/user-attachments/assets/acc7f9cb-bb2d-4db5-b733-5e5468fcff76)
- Unset winner  
![ezgif-7-34f4f654c4](https://github.com/user-attachments/assets/2363ca84-0464-4963-b0aa-1f27911bfe70)
- Swap Zelda/Sheik  
![ezgif-2-9c596e3604](https://github.com/user-attachments/assets/4f88c0ca-0efd-4968-b791-ffed3eed193e)
- Can use a manually entered list of names if not using start.gg or challonge  
![Screenshot 2024-08-09 at 20 49 31](https://github.com/user-attachments/assets/a4335fb1-c6f1-4299-b586-a1805d759847)

## Users
Please [check discussions/ask for help](https://github.com/jmlee337/replay-manager-for-slippi/discussions) before [checking issues/filing a bug report or feature request](https://github.com/jmlee337/replay-manager-for-slippi/issues).
## Development
Clone the repo and install dependencies:
```bash
git clone https://github.com/jmlee337/replay-manager-for-slippi.git replay-manager-for-slippi
cd replay-manager-for-slippi
npm install
```
Start the app in the `dev` environment:
```bash
npm start
```
To package apps for the local platform:

```bash
npm run package
```
