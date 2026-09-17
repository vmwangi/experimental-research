# Experimental Research Project: self-paced activity

An interactive, self-paced version of the Experimental Design and A/B Testing workshop. Learners play Juma, a product data analyst at Tuma (a Nairobi mobile wallet), and take one business problem through five stages:

1. Frame the hypothesis
2. Population and metrics
3. Run the experiment
4. Interpret the results
5. Make the decision

Each stage has four steps: **Learn**, **Watch Juma**, **Your turn** (multiple choice with feedback on every option) and **Reveal** (the answer and the entry for Juma's project file). A matching activity closes the project.

## Features

- Nine questions in three interaction styles — multiple choice (with specific feedback for every wrong option), a drag-to-order task, and a slider estimate — plus retries and a "Show me the answer" option after two wrong tries
- **Points and streaks.** Every answer earns XP: full marks first try, less for each retry, a streak bonus for consecutive first-try wins, and a rank that climbs from "Analyst in Training" to "Head of Insight"
- **Confidence wager.** Before checking, learners wager how sure they are (Hunch / Confident / Certain), which multiplies the points at stake — Certain doubles a win but stings a miss
- **Badges.** Ten achievements (Flawless, No Peeking, Comeback, High Roller, Experimenter, and more) unlock with a toast and confetti
- **Experiment Lab.** An interactive A/B-test sandbox: set the baseline, the true lift, and the sample size, then run the experiment and watch the read wobble while the truth holds still — the required sample and power update live
- **Branching consequences.** The decision stage shows what actually happens to Juma for the call you make, and what would have happened had you chosen differently
- **Challenge mode.** Hides Juma's worked examples and runs a clock, tracking a personal best
- **Shareable result card.** At the finish, a PNG card of your rank, XP, score and badges, ready to share (the Web Share sheet surfaces WhatsApp on phones), download, or post as text
- Celebrations (confetti, optional sound) that all switch off for "reduce motion"; stages unlock in order; Juma's project file builds up and downloads as text
- Progress, points and badges are saved in the learner's browser (localStorage), with a "Start over" button
- Keyboard and screen reader friendly, works on phones, no build step and no dependencies

## Tests

Pure logic (scoring, streaks, simulator maths, answer-checking, badges, and content integrity) lives in `assets/logic.js` and is covered by a shared suite in `tests/cases.js`:

- **In the browser:** open `tests.html` — it runs every assertion and shows pass/fail.
- **In Node:** `node tests/run-node.js` (no dependencies to install).

Both run the same cases against the same code the app uses.

## Publish on GitHub Pages

1. Create a new public repository on GitHub (for example `experimental-research-project`).
2. Upload **the contents** of this folder to the root of the repository (so `index.html` sits at the top level, next to the `assets` folder and `.nojekyll`).
   - On the web: **Add file > Upload files**, drag everything in, commit. Hidden files such as `.nojekyll` may not upload by drag and drop; the site works without it, or create it with **Add file > Create new file** named `.nojekyll` and leave it empty.
   - With git: `git add . && git commit -m "Add activity" && git push`
3. Go to **Settings > Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
4. After a minute or two the site is live at `https://<your-username>.github.io/<repository-name>/`.

## Editing content

All text, questions, answers and feedback live in `assets/data.js`. Each question has an `answer` key and a `feedback` line for every option. The app reads everything from that file, so no other file needs to change.

## Files

```
index.html          page shell
assets/data.js      content and question bank
assets/logic.js     pure scoring / simulator / badge logic (shared with the tests)
assets/app.js       app logic and rendering
assets/style.css    styles
assets/img/         illustrations from the workshop slides
tests.html          in-browser test runner
tests/cases.js      shared test cases
tests/run-node.js   Node test runner
.nojekyll           tells GitHub Pages to serve files as they are
```
