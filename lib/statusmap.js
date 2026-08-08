// Maps each client's raw Notion "Status" value to one of the 7 canonical stages.
// All three mapped clients share this 13-step vocabulary. If a new client uses
// different status names, add them here.

const STATUS_MAP = {
  "Idea Bank": "Intake",              // Brad's board
  "1- Idea Assigned": "Intake",
  "2- Waiting for Brief": "Intake",
  "2- Waiting For Brief": "Intake",
  "3- Transcript": "Scripting",
  "4- Script Draft": "Scripting",
  "5- Script Approval Brand/Creator": "Scripting",
  "5- Script Approval - Brand/Creator": "Scripting", // Brad's spelling

  "6- To Film": "Ready to Edit",
  "7- In Edit": "Editing",
  "8- Changes": "Editing",
  "9- Approval Brand/Creator": "Review",
  "10- To Post": "Ready to Post",
  "11- Ready": "Ready to Post",
  "Scheduled": "Ready to Post",
  "12- Posted": "Published",
  "13- Repost": "Published",
  "Archive": "Archived",
  "Archived": "Archived",
};

const STAGES = ["Intake", "Scripting", "Ready to Edit", "Editing", "Review", "Ready to Post"];
const ACTIVE_STAGES = ["Scripting", "Ready to Edit", "Editing", "Review"];

module.exports = { STATUS_MAP, STAGES, ACTIVE_STAGES };
