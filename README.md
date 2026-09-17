# Experimental Research Project: self-paced activity

An interactive, self-paced version of the Experimental Design and A/B Testing workshop. Learners play Juma, a product data analyst at Tuma (a Nairobi mobile wallet), and take one business problem through five stages:

1. Frame the hypothesis
2. Population and metrics
3. Run the experiment
4. Interpret the results
5. Make the decision

Each stage has four steps: **Learn**, **Watch Juma**, **Your turn** (multiple choice with feedback on every option) and **Reveal** (the answer and the entry for Juma's project file). A matching activity closes the project.

## Features

- Seven questions with specific feedback for each wrong option, retries, and a "Show me the answer" option after two wrong tries
- Stages unlock in order; the reveal unlocks once the stage's questions are answered
- Juma's project file builds up as learners finish each stage and can be downloaded as a text file
- Score counts answers correct on the first try
- Progress is saved in the learner's browser (localStorage), with a "Start over" button
- Smooth page transitions that slide forward or back with the direction of travel, plus animated feedback, progress bar and project file updates; all motion switches off for learners who set "reduce motion" on their device
- Keyboard and screen reader friendly, works on phones, no build step and no dependencies

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
assets/app.js       app logic
assets/style.css    styles
assets/img/         illustrations from the workshop slides
.nojekyll           tells GitHub Pages to serve files as they are
```
