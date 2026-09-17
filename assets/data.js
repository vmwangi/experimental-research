/* Content for the Experimental Research Project self-paced activity.
   Source: Experimental Design Project workshop slides. */
window.WORKSHOP = {
  title: "Experimental Research Project",
  subtitle: "From a business problem to a decision the business can sign: experimental design and A/B testing, worked end to end.",

  lab: {
    intro: "This is Juma's sandbox. Set a baseline verification rate, the true lift the new flow really has, and how many users you put in each arm. Then run the experiment and watch what a single test actually sees. Run it again and again: the truth never moves, but the read does. That wobble is why sample size and holding your horizon matter.",
    note: "Nothing here is scored. Break it, push the sliders to the edges, and see what a test can and cannot tell you."
  },

  setting: {
    intro: "Tuma is a mobile wallet used across Nairobi. People install the app, verify their ID, and then send money, pay bills and buy airtime. Tuma earns a small fee on each transaction. Nobody can transact until they are verified.",
    stats: [
      ["7,000", "new sign-ups a week"],
      ["55%", "verify within 7 days"],
      ["KES 420", "fees per verified user, first 90 days"],
      ["0.9%", "of verifications flagged as fraud"],
      ["3.8%", "rejected by compliance review"]
    ],
    problem: "45 of every 100 people who install Tuma never verify their ID, so they never send a shilling. The growth lead wants it fixed this quarter. Product has a redesign ready: ID photo and selfie captured on one screen, automatically, instead of a three-screen upload. It will take six engineer-weeks to build. The question on Juma's desk: should Tuma build it?"
  },

  persona: {
    name: "Juma",
    role: "Product data analyst, Tuma, Nairobi",
    bio: "Two years at Tuma. Sits with the product team, reports to the head of product, and is the person the growth lead calls when a number needs to mean something.",
    job: "His job today is not to prove the redesign works. It is to find out whether Tuma should build it, and to say so in a way the head of product can sign.",
    lastProject: "Last quarter marketing wanted to pay users KES 100 for every friend they referred who verified. Juma took it from a budget line to a rollout through the same five stages you will work through today."
  },

  stages: [
    {
      num: 1,
      title: "Frame the hypothesis",
      clock: "9:00",
      tagline: "From a business problem to a claim you can be wrong about, and the boring world it has to beat.",
      learn: [
        ["A problem is not a hypothesis.", "'Onboarding is broken' cannot be tested. A hypothesis names a specific change, the group it reaches, the outcome it should move and the direction. Start from the decision: what would the business do differently if the claim is true, and if it is false?"],
        ["The null is the boring world, the alternative is yours.", "Null: the change makes no difference to the outcome. Alternative: it does. The test asks whether the data is surprising enough under the null to reject it. Failing to reject is not proof the null is true; it usually means 'we could not tell'."],
        ["Two-sided unless a harm is impossible.", "A redesign can make things worse and you need to be able to see that. Fix significance at 5 percent and power at 80 percent now, before any data exists, and write all of it where the team can see it."]
      ],
      steps: [
        "Write the business problem in one line, with a number",
        "Ask what would be done differently under each answer",
        "Name the change, the group, the outcome and the direction",
        "Check a skeptic could read it and say 'I doubt it'",
        "Write the null: same outcome with and without the change",
        "Write the alternative, two-sided, with alpha 5 and power 80",
        "Agree what 'could not tell' will be called if it happens"
      ],
      failure: "Testing an idea someone already loves, framed so loosely that any result is a win, with the null written after the data arrives.",
      watch: {
        situation: "Sign-up growth had flattened. Marketing proposed a KES 100 airtime bonus for every friend a user refers who then verifies. It had a budget and a start date, no question attached, and marketing wanted to test only whether referrals went up, since 'a bonus can't make people refer less'.",
        did: "Juma asked what would change under each answer: if referrals rise enough to pay for the bonuses, marketing funds it permanently; if not, the budget goes back to paid social. That gave him a decision and a claim. He kept the test two-sided, because a bonus can attract referrals that never verify, and fixed alpha and power before a launch date was picked.",
        artifact: [
          ["Problem", "New verified sign-ups flat at about 7,000 a week"],
          ["Hypothesis", "Offering a KES 100 bonus per referred friend who verifies increases verified referrals per active user within 30 days"],
          ["Decision, owner", "Fund the bonus permanently or not; head of marketing"],
          ["Null", "Verified referrals per user are the same with and without the bonus"],
          ["Alternative", "They differ, in either direction"],
          ["Alpha, power", "5 percent, 80 percent"],
          ["Agreed phrase", "'We could not tell', never 'no effect'"]
        ],
        result: "One sentence, one owner, one budget line, and nobody argued later about what the test was for. It was written down."
      },
      questions: [
        {
          id: "q1",
          prompt: "Which is the best hypothesis?",
          desk: "The growth lead: 'Onboarding is broken. Fix verification this quarter.' Product has a redesign ready: ID photo and selfie on one screen with auto-capture, replacing the three-screen upload. Six engineer-weeks to build.",
          image: "dashboard.png",
          answer: "c",
          options: [
            { key: "a", text: "The redesigned verification flow will improve the onboarding experience for everyone who installs Tuma",
              feedback: "'Improve the onboarding experience' is not an outcome anyone can count, and 'everyone who installs' is not the group the flow reaches. Almost any result could be read as a win, so a skeptic has nothing to doubt." },
            { key: "b", text: "New users will like the single-screen flow more than the current three-screen flow",
              feedback: "This is about feelings, not behaviour. Users can like a flow and still not verify. The decision depends on how many people verify, so the hypothesis has to name that outcome." },
            { key: "c", text: "Replacing the three-screen upload with single-screen auto-capture increases the share of new sign-ups who verify within 7 days",
              feedback: "It names the change, the group (new sign-ups), the outcome (verified within 7 days) and the direction, and a skeptic can doubt it." },
            { key: "d", text: "The three-screen flow is the reason 45 percent of sign-ups never make a transaction on Tuma",
              feedback: "This is a claim about the past. An experiment on a new flow cannot settle why people failed to transact before. It also swaps the outcome from verifying to transacting." }
          ]
        },
        {
          id: "q2",
          prompt: "Which pair is correct?",
          desk: "The 7-day verification rate today is about 55 percent. Product is confident the new flow can only help. Juma needs the null and the alternative written down before anything is built.",
          image: "id-capture.png",
          answer: "d",
          options: [
            { key: "a", text: "Null: the new flow verifies fewer users than the old flow. Alternative: the new flow verifies more users",
              feedback: "The null is the boring world of no difference, not 'fewer'. This pair also has no place for 'the same', and it is one-sided in spirit, which would hide the case where auto-capture fails on some phones." },
            { key: "b", text: "Null: the new flow is better for users. Alternative: the new flow is worse for users",
              feedback: "'Better for users' is not a measurable outcome, and the null here claims an effect instead of no effect. The null must be 'the 7-day verification rate is the same in both flows'." },
            { key: "c", text: "Null: 55 percent of new sign-ups verify. Alternative: 60 percent of new sign-ups verify",
              feedback: "This confuses a hypothesis with a forecast of two numbers. The test compares the two flows against each other; it does not check whether a rate lands on a particular value." },
            { key: "d", text: "Null: the 7-day verification rate is the same in both flows. Alternative: the rate is different, in either direction",
              feedback: "The null is 'no difference'. The alternative is two-sided because auto-capture can fail on some phones and make things worse; a one-sided test would hide that." }
          ]
        },
        {
          id: "q1c",
          type: "order",
          prompt: "Put the path from a business problem to a testable hypothesis in the right order.",
          desk: "The growth lead drops one line on your desk: 'Onboarding is broken, fix verification this quarter.' Before anything can be tested, that has to become a claim a skeptic could doubt. Drag the steps into order.",
          sequence: [
            "State the business problem in one line, with a number",
            "Ask what the business would do differently under each answer",
            "Name the change, the group, the outcome and the direction",
            "Write the null, and a two-sided alternative with alpha and power"
          ],
          shuffle: [2, 0, 3, 1],
          feedback: "A hypothesis is built, not guessed. Pin the problem to a number, find the decision it feeds, name the change and the outcome it should move, then write the boring world it has to beat."
        }
      ],
      fileEntry: "Hypothesis: single-screen auto-capture increases the share of new sign-ups who verify within 7 days. Decision: whether to spend six engineer-weeks and ship it; owner, head of product. Null: same rate in both flows. Alternative: different, either direction. Alpha 5 percent, power 80 percent. If the interval spans zero, the report says 'could not tell'."
    },

    {
      num: 2,
      title: "Population and metrics",
      clock: "10:30",
      tagline: "Who the change can reach, what one unit is, and what success is measured in.",
      learn: [
        ["The population is who the change can actually reach, from the moment it launches.", "The unit of randomization matches how the change is delivered: a user sees one flow, so the unit is the user. Randomizing sessions lets one person see both arms. Exclusions are written before launch, with reasons."],
        ["The primary metric is the outcome in the hypothesis,", "written as numerator, denominator and window so two analysts get the same number. It measures what the user does, not what the app shows: taps, screens and time on page are activity, not results."],
        ["Secondaries explain the primary; guardrails catch what it hides.", "If verification rises, does first transaction rise too? Auto-capture that accepts blurry IDs lifts verification and raises fraud. Name the guardrails and their limits before launch."]
      ],
      steps: [
        "Name who the change reaches from launch, and the weekly flow",
        "Set the unit to match how the change is delivered",
        "List exclusions and the reason for each, before launch",
        "Write the primary as numerator, denominator and window",
        "Add secondaries that would explain a surprising primary",
        "Add guardrails, each with a numeric limit",
        "Name one tempting metric you reject, and why"
      ],
      failure: "Randomizing at the wrong level, then measuring the app's activity instead of the customer's behaviour, with no guardrail on the thing that carries the risk.",
      watch: {
        situation: "Marketing wanted every registered account in the referral test, 'more users means faster results', and wanted 'invites sent' as the headline metric because the dashboard already showed it.",
        did: "Unverified users cannot refer, so they only dilute the estimate. Juma set the population to verified users active in the last 30 days, one arm per user by hashing the user ID, and excluded staff accounts and users in the concurrent pricing test, in writing. Invites are free to send and prove nothing, so the primary became verified referrals per user; the two real risks went into guardrails.",
        artifact: [
          ["Population", "Verified users active in the last 30 days, about 150,000"],
          ["Unit", "The user, by hash of user ID and an experiment name"],
          ["Excluded", "Staff and test accounts; users in the pricing experiment"],
          ["Primary", "Verified referrals per active user within 30 days"],
          ["Secondary", "Invites sent per user"],
          ["Guardrails", "Cost per incremental verified user; fraud flag rate on referred accounts, limit 1.5 percent"],
          ["Rejected", "Invites sent as primary"]
        ],
        result: "Both arms were the same kind of people before the bonus existed, and the fraud guardrail let the team say yes without a lawyer in the room."
      },
      questions: [
        {
          id: "q3",
          prompt: "Who is in the test, and what is one unit?",
          desk: "Tuma gets about 7,000 new sign-ups a week. There are also about 300,000 older accounts that installed the app and never verified. The growth lead wants 'everyone who hasn't verified' in the test.",
          image: "ab-split.png",
          answer: "b",
          options: [
            { key: "a", text: "Every account that has ever installed Tuma and not verified, randomized at the account level",
              feedback: "The old unverified accounts already failed once under a different flow and mostly will not return. Including them answers a rescue question, not a flow question, and dilutes the estimate." },
            { key: "b", text: "New sign-ups from launch day onward, randomized at the user level when they first reach the verification step",
              feedback: "New sign-ups at the verification step, one arm per user, is exactly the group the hypothesis names, and the unit matches how the flow is delivered." },
            { key: "c", text: "Only users who abandoned verification in the last month, since they are the ones with the problem",
              feedback: "These users already abandoned under the old flow, so this is still a rescue question. It also leaves out the new sign-ups the hypothesis is about." },
            { key: "d", text: "Every session on the verification screen, randomized per session so the sample grows faster",
              feedback: "Per-session assignment lets one person see both flows, so the arms are no longer separate. A bigger sample does not help if the units are contaminated." }
          ]
        },
        {
          id: "q4",
          prompt: "Which metric set is right?",
          desk: "The product dashboard for the new flow shows taps on 'verify now', photos taken, time on screen and the app store rating. Compliance reviews every verification; today it rejects about 3.8 percent, and 0.9 percent are flagged as fraud.",
          image: "id-capture.png",
          answer: "c",
          options: [
            { key: "a", text: "Primary: taps on 'verify now'. Secondary: photos taken. Guardrail: app store rating",
              feedback: "Taps and photos are app activity, not the customer outcome. And the app store rating does nothing to catch the real risk of auto-capture: bad IDs getting through." },
            { key: "b", text: "Primary: time spent on the verification screen. Secondary: completions. Guardrail: app crashes",
              feedback: "Time on screen can move either way for good or bad reasons, so it is activity, not a result. Completions belong in the primary, and the guardrail misses fraud and compliance risk." },
            { key: "c", text: "Primary: share of new sign-ups verified within 7 days. Secondary: first transaction within 30 days. Guardrails: fraud flag rate and compliance rejection rate, each with a limit",
              feedback: "The primary is the outcome in the hypothesis. First transaction tells you whether the extra verified users are real customers. The two guardrails hold the specific risk of auto-capture: pushing bad IDs through." },
            { key: "d", text: "Primary: app store rating in the first month. Secondary: verifications. Guardrail: support tickets",
              feedback: "A rating is an opinion from a few vocal users, not the outcome the hypothesis names. Verifications should be the primary, and there is still no guardrail on fraud." }
          ]
        }
      ],
      fileEntry: "Population: new sign-ups reaching the verification step from launch, about 7,000 a week. Unit: user, by hash of user ID. Excluded: staff and test accounts. Primary: verified within 7 days of sign-up. Secondary: first transaction within 30 days. Guardrails: fraud flag rate, limit 1.5 percent; compliance rejection rate, limit 5 percent. Rejected: taps and time on screen."
    },

    {
      num: 3,
      title: "Run the experiment",
      clock: "12:00",
      tagline: "Assign at random, size it from the decision, run whole weeks, and keep your hands off the primary.",
      learn: [
        ["Size it from the decision.", "The minimum detectable effect (MDE) is the smallest lift that would justify the cost. With the baseline, power and significance, that gives the sample per arm; divide by weekly eligible users, add the outcome window, round to whole weeks."],
        ["Assign with a deterministic hash of the user ID,", "so the same user always lands in the same arm and the split can be audited. Check the split on day one: a 50/50 design that arrives at 53/47 is a bug, not noise."],
        ["While it runs, watch the guardrails, not the primary.", "Checking the primary every morning and stopping when it looks good turns a 5 percent false positive rate into something far worse. Fix the horizon and hold it."]
      ],
      steps: [
        "Take the MDE from the cost of acting on the result",
        "Compute sample per arm at 80 percent power, 5 percent significance",
        "Divide by weekly eligible units, add the outcome window, round up",
        "Assign by hashing user ID with an experiment name",
        "Check the arm split and data flow on day one",
        "Monitor guardrails daily; look at the primary once, at the end"
      ],
      failure: "Peeking at the primary daily and calling the test the first morning it looks significant.",
      watch: {
        situation: "Baseline was 0.12 verified referrals per user. Marketing would fund the bonus permanently for a lift of 0.03 or more.",
        did: "At that MDE the test needed about 20,000 users per arm. With 150,000 eligible, enrollment was instant; the 30-day window set the duration. Juma fixed the horizon at five weeks, checked the split on day two, and published which numbers were watched daily and which were sealed until the end.",
        artifact: [
          ["MDE", "0.03 verified referrals per user, from the bonus budget"],
          ["Sample", "About 20,000 users per arm"],
          ["Assignment", "Hash of user ID and 'referral-bonus-q2'"],
          ["Split check, day 2", "50.1 / 49.9, passed"],
          ["Watched daily", "Fraud flag rate, bonus spend"],
          ["Sealed until the end", "The primary"]
        ],
        result: "The test ended on the date it was meant to, and the result meant what it said."
      },
      questions: [
        {
          id: "q5",
          prompt: "Which plan is right?",
          desk: "Baseline: 55 percent verify within 7 days. Product says anything under a 5-point lift would not justify the rebuild. About 7,000 new sign-ups a week. The outcome window is 7 days.",
          image: "ab-split.png",
          answer: "a",
          options: [
            { key: "a", text: "About 1,600 per arm. Enroll for one full week, wait out the 7-day window, read the primary once at two weeks",
              feedback: "A two-proportion calculation at 55 versus 60 percent needs about 1,550 per arm. Half a week would fill it, but a whole week gives both arms the same weekly cycle, and then every user needs the 7-day window." },
            { key: "b", text: "About 16,000 per arm and six weeks, to be safe",
              feedback: "That is about ten times the sample the 5-point MDE needs. 'To be safe' costs a month of delay and changes nothing about the decision." },
            { key: "c", text: "Enroll continuously and check each morning; stop the day the difference is significant",
              feedback: "This is the peeking failure. Checking every morning and stopping on the first good day turns a 5 percent false positive rate into something far worse." },
            { key: "d", text: "About 160 per arm; at 7,000 sign-ups a week, three days is plenty",
              feedback: "160 per arm can only detect a huge lift, far bigger than 5 points. Three days also skips a full weekly cycle, and the 7-day outcome window has not even closed." }
          ]
        },
        {
          id: "q5b",
          type: "slider",
          prompt: "Drag to the sample size a 55% vs 60% test needs, per arm.",
          desk: "Baseline verification is 55 percent. Product will only rebuild for a 5-point lift or better, at 80 percent power and 5 percent significance. Roughly how many users does each arm need before a lift that size would show?",
          image: "ab-split.png",
          min: 0,
          max: 6000,
          step: 50,
          start: 3000,
          answer: 1550,
          tolerance: 350,
          unit: " per arm",
          feedback: "About 1,550 per arm. Far fewer and only a huge, unrealistic lift would ever show; far more just buys weeks of delay the decision does not need. Open the Lab to feel how sample size trades against the effect you can catch."
        }
      ],
      fileEntry: "Sample: about 1,600 per arm (one full week of sign-ups gives 3,500 per arm, more than enough). Horizon: two weeks, fixed. Assignment: hash of user ID and 'verify-flow-q3'. Day-one checks: arm split, data arriving from the compliance system. Daily: guardrails only. Primary: sealed until the end."
    },

    {
      num: 4,
      title: "Interpret the results",
      clock: "14:00",
      tagline: "The difference, its interval, the guardrails, and where all of that sits against the bar you set.",
      learn: [
        ["Report the difference and its 95 percent interval before any p-value.", "The interval is the range of effects the data is consistent with. Whether it clears the pre-agreed bar is the reading that matters."],
        ["Two misreadings cause most of the damage.", "Treating an interval that spans zero as 'no effect' when the test could not tell. And treating a significant result as an important one when the sample is large enough to make anything significant."],
        ["Read the guardrails before celebrating the primary.", "A lift that comes with a fraud spike is not a lift. And a secondary that fails to move can tell you the primary moved for the wrong reason."]
      ],
      steps: [
        "Check the arm split before looking at any outcome",
        "Compute the difference, its standard error and the 95 percent interval",
        "Compare the whole interval against the pre-agreed bar",
        "Read the guardrails against their limits",
        "Read the secondaries for mechanism",
        "Write the reading in one sentence, with the interval in it"
      ],
      failure: "Rounding an interval to a point estimate and giving the room a confidence the data does not support.",
      watch: {
        situation: "The referral bonus result: 0.16 verified referrals per user in treatment against 0.12 in control.",
        did: "Juma reported a lift of 0.04 with an interval of 0.03 to 0.05, then read it against the bar: the whole interval sits at or above 0.03. Fraud on referred accounts was 1.0 percent against a 1.5 percent limit. Invites sent had doubled, which explained the mechanism.",
        artifact: [
          ["Treatment vs control", "0.16 vs 0.12 referrals per user"],
          ["Difference", "0.04, interval 0.03 to 0.05"],
          ["Pre-agreed bar", "0.03"],
          ["Reading", "The whole interval clears the bar"],
          ["Guardrail", "Fraud 1.0 percent, under the 1.5 percent limit"],
          ["Secondary", "Invites doubled: the mechanism is real"]
        ],
        result: "One sentence, with the interval in it, and the guardrail beside it. Nothing to argue about."
      },
      questions: [
        {
          id: "q6",
          prompt: "What is the best reading?",
          desk: "Two weeks later, 3,500 per arm. Verified within 7 days: 61.2 percent in the new flow, 55.4 percent in the old. Lift 5.8 points, 95 percent interval 3.5 to 8.1. First transaction within 30 days: 33.9 versus 30.8 percent. Fraud flags 1.0 versus 0.9 percent; compliance rejections 4.1 versus 3.8 percent.",
          image: "interval.png",
          answer: "c",
          options: [
            { key: "a", text: "5.8 beats 5, so the flow works, and the guardrails are close enough to ignore",
              feedback: "This rounds the interval to a point estimate. The data is consistent with a lift as low as 3.5 points. And guardrails are never ignored: you read each one against its limit." },
            { key: "b", text: "The interval includes values below 5, so the test failed and the flow should be dropped",
              feedback: "The interval excludes zero, so the flow really does verify more users. Not clearing the bar cleanly is a reason to report the range, not a reason to call the test a failure." },
            { key: "c", text: "A real lift of 3.5 to 8.1 points, guardrails within limits, and more first transactions. The data cannot confirm the lift is above 5; report the range",
              feedback: "The interval excludes zero, and the secondary shows the extra users go on to transact. Both guardrails are under their limits. The interval also includes values below 5, so the honest sentence carries the range." },
            { key: "d", text: "Significant at p below 0.05, which is all the growth lead needs to hear",
              feedback: "Significant is not the same as important. A p-value says nothing about how big the lift is, where it sits against the bar, or whether the guardrails held." }
          ]
        }
      ],
      fileEntry: "Reading: the new flow lifts 7-day verification by 5.8 points (interval 3.5 to 8.1). Guardrails held: fraud 1.0 percent, rejections 4.1 percent. First transactions up 3.1 points. The lift may sit below the 5-point bar."
    },

    {
      num: 5,
      title: "Make the decision",
      clock: "15:30",
      tagline: "Turn the interval into money, set it against the full cost, and write the recommendation with the reason.",
      learn: [
        ["Convert the effect into people, then into money.", "Extra verified users per week, times weeks, times what a verified user is worth in fees. Do it at the point estimate and at both ends of the interval."],
        ["Compare against the full cost:", "the build, the maintenance, and what the same engineers would otherwise have done. Then say what being wrong costs in each direction."],
        ["Write the recommendation and the reason in the same sentence.", "Two hard calls are the mark of a good analyst: shipping something inconclusive when it is cheap and reversible, and declining something significant when it is worth nothing."]
      ],
      steps: [
        "Convert the lift into outcomes per period",
        "Convert outcomes into money using what an outcome is worth",
        "Compute it at the point estimate and both interval ends",
        "Set it against the full cost, including opportunity cost",
        "State what a false positive and a false negative would cost",
        "Write the recommendation, the reason and what to watch after"
      ],
      failure: "'Not significant, we need more data' as the only sentence an analyst can say to a team with a budget deadline.",
      watch: {
        situation: "A lift of 0.04 referrals per user across 150,000 eligible users, at KES 420 in fees per verified user over 90 days.",
        did: "Juma converted it: about 6,000 extra verified users a year, roughly KES 2.5 million, against about KES 1.1 million in bonus payouts, positive at both ends of the interval. He recommended rolling out with the fraud guardrail kept on the dashboard, and wrote the number in shillings.",
        artifact: [
          ["Extra verified users", "About 6,000 a year at the point estimate"],
          ["Value", "About KES 2.5 million a year"],
          ["Cost", "About KES 1.1 million a year in bonuses"],
          ["At the lower bound", "Still positive"],
          ["Recommendation", "Roll out; keep the fraud guardrail on the dashboard"]
        ],
        result: "Marketing funded it in the next budget round. The decision took one meeting."
      },
      questions: [
        {
          id: "q7",
          prompt: "What is the recommendation?",
          desk: "A 5.8-point lift on 7,000 sign-ups a week is about 400 extra verified users a week, roughly 21,000 a year, worth about KES 8.9 million in fees. At the lower bound (3.5 points) about KES 5.3 million; at the upper (8.1) about KES 12.4 million. The rebuild costs six engineer-weeks, about KES 1.8 million, plus KES 200,000 a year for the capture SDK.",
          image: "decision.png",
          answer: "b",
          options: [
            { key: "a", text: "Do not ship: the interval crossed the 5-point bar that product set",
              feedback: "The 5-point bar was a stand-in for 'worth the rebuild'. In shillings the rebuild pays for itself at about 1.2 points, and even the pessimistic end (3.5 points, KES 5.3 million) is far above the cost.",
              outcome: "Three months on, verification is still stuck at 55 percent and roughly KES 5 to 12 million a year is left on the table. The growth lead escalates over Juma's head, and a rushed rebuild ships anyway, this time with no clean read on whether it worked." },
            { key: "b", text: "Ship: even the lower bound returns more than twice the full cost. Keep the fraud and rejection guardrails on the dashboard for 90 days",
              feedback: "In shillings, the rebuild pays for itself at about 1.2 points, and the pessimistic end of the interval is three times that. Keeping the guardrails on the dashboard protects the result after launch.",
              outcome: "The flow ships. Verification climbs, first transactions follow, and the fraud line on the dashboard never twitches because it is being watched. The decision took one meeting, and the head of product signs Juma's file without a single follow-up question." },
            { key: "c", text: "Run a second test for six more weeks so the interval clears 5 points cleanly",
              feedback: "More weeks would cost money and change nothing. The lower bound already pays for the rebuild more than twice over, so the decision is the same whatever a longer test shows.",
              outcome: "Six weeks and a chunk of budget later, the interval barely moves. The team ships exactly what the first test already justified, only now a quarter late, and the growth lead has stopped trusting the word 'test'." },
            { key: "d", text: "Ship, and drop the compliance review since fraud did not move",
              feedback: "Shipping is right, but dropping the review removes the guardrail that made the result trustworthy. Fraud stayed flat partly because compliance was checking.",
              outcome: "The flow ships and the number looks great, until month two, when a wave of auto-captured bad IDs sails through unchecked. The fraud spike claws back the win, and the post-mortem lands on the desk of the analyst who removed the guardrail." }
          ]
        }
      ],
      fileEntry: "Recommendation: ship the single-screen flow. Value KES 5.3 to 12.4 million a year against KES 2.0 million in year one. Keep fraud and rejection rates on the dashboard for 90 days. Lesson filed: set the bar in shillings before the test, not in points after it."
    }
  ],

  closing: {
    lesson: "Set the bar in shillings before the test, not in points after it.",
    epilogueGood: "You shipped the flow the numbers backed, with the guardrails still on. Verification climbs, the fraud line stays flat, and Juma's file gets signed in one meeting. This is what an analyst the business can trust looks like.",
    epilogueBad: "The decision you filed would have cost Tuma money, trust, or both. Reread the reveal on stage five: the whole point of five stages of careful work is a final call that survives contact with a budget meeting.",
    match: [
      { stage: 1, text: "What exactly changes, for whom, and what should it move? And what is the boring world we have to beat?" },
      { stage: 2, text: "Who can the change reach, what is one unit, what currency settles the decision, and which guardrail carries the risk?" },
      { stage: 3, text: "What lift would justify the cost, how many whole weeks does that buy, and what is sealed until the end?" },
      { stage: 4, text: "Where does the whole interval sit against the bar, and did the guardrails hold?" },
      { stage: 5, text: "What is it worth in shillings at both ends of the interval, against the full cost?" }
    ]
  }
};
