# Replay Manager for Slippi
Replay Manager for Slippi helps users integrate [Slippi replays](https://github.com/project-slippi/slippi-wiki/blob/master/SPEC.md) with [start.gg](https://www.start.gg/) brackets.
It enables a workflow where Slippi replays are collected set-by-set, used to report set results (including character and stage data), and grouped/labelled for easier organization.
## Features
- Auto-detect USB drive
- "Safely Remove" USB drive on replay folder deletion
- Mark set called, report winner, DQ manually  
![Screenshot 2024-07-20 101744](https://github.com/user-attachments/assets/026bed5f-59a8-43f9-82b5-cdfdc88368c9)  
![Screenshot 2024-07-20 101736](https://github.com/user-attachments/assets/bd927d3d-26d6-48b4-82dd-663b957da014)  
![Screenshot 2024-07-20 101806](https://github.com/user-attachments/assets/6db64645-52be-4ba6-9c06-728913aa6f0d)
- 1-click report, copy, delete  
![Screenshot 2024-07-20 100937](https://github.com/user-attachments/assets/d6c2d916-4d82-4d84-8878-63f9731d7cbc)
- Batch set players  
![ezgif-2-173f6cddcc](https://github.com/user-attachments/assets/5df4f4af-9715-4141-b150-65d1a6f0a236)
- Set players per match if necessary  
![ezgif-2-ced60802c4](https://github.com/user-attachments/assets/ba0c6227-7d9b-49a7-90d5-160c37d000fb)
- Set/override winner  
![ezgif-2-68e8104996](https://github.com/user-attachments/assets/9eeb1482-5637-4930-a3a4-3c379ad91571)
- Swap Zelda/Sheik  
![ezgif-2-9c596e3604](https://github.com/user-attachments/assets/4f88c0ca-0efd-4968-b791-ffed3eed193e)

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
