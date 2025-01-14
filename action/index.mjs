//Imports
  import setup from "./../src/setup.mjs"
  import metrics from "./../src/metrics.mjs"
  import octokit from "@octokit/graphql"
  import core from "@actions/core"
  import github from "@actions/github"
  import mocks from "./../src/mocks.mjs"

;((async function () {
  //Yaml boolean converter
    const bool = (value, defaulted = false) => typeof value === "string" ? /^(?:[Tt]rue|[Oo]n|[Yy]es)$/.test(value) : defaulted
  //Debug message buffer
    const debugged = []
  //Runner
    try {
      //Initialization
        console.log(`GitHub metrics`)
        console.log("─".repeat(64))
        process.on("unhandledRejection", error => { throw error })

      //Skip process if needed
        if ((github.context.eventName === "push")&&(github.context.payload?.head_commit)) {
          if (/\[Skip GitHub Action\]/.test(github.context.payload.head_commit.message)) {
            console.log(`Skipped because [Skip GitHub Action] is in commit message`)
            process.exit(0)
          }
        }

      //Load configuration
        const conf = await setup({log:false})
        console.log(`Configuration             │ loaded`)
        console.log(`Version                   │ ${conf.package.version}`)

      //Debug mode
        const debug = bool(core.getInput("debug"))
        if (!debug)
          console.debug = message => debugged.push(message)
        console.log(`Debug mode                │ ${debug}`)
        const dflags = (core.getInput("debug_flags") || "").split(" ").filter(flag => flag)
        console.log(`Debug flags               │ ${dflags.join(" ") || "(none)"}`)

      //Load svg template, style, fonts and query
        const template = core.getInput("template") || "classic"
        console.log(`Template to use           │ ${template}`)

      //Token for data gathering
        const token = core.getInput("token") || ""
        console.log(`Github token              │ ${/^MOCKED/.test(token) ? "(MOCKED)" : token ? "provided" : "missing"}`)
        if (!token)
          throw new Error("You must provide a valid GitHub token to gather your metrics")
        const api = {}
        api.graphql = octokit.graphql.defaults({headers:{authorization: `token ${token}`}})
        console.log(`Github GraphQL API        │ ok`)
        api.rest = github.getOctokit(token)
        console.log(`Github REST API           │ ok`)
      //Apply mocking if needed
        if (bool(core.getInput("use_mocked_data"))) {
          Object.assign(api, await mocks(api))
          console.log(`Mocked Github API         │ ok`)
        }
      //Extract octokits
        const {graphql, rest} = api

      //SVG output
        const filename = core.getInput("filename") || "github-metrics.svg"
        console.log(`SVG output file           │ ${filename}`)

      //SVG optimization
        const optimize = bool(core.getInput("optimize"), true)
        conf.optimize = optimize
        console.log(`SVG optimization          │ ${optimize}`)

      //GitHub user
        let authenticated
        try {
          authenticated = (await rest.users.getAuthenticated()).data.login
        }
        catch {
          authenticated = github.context.repo.owner
        }
        const user = core.getInput("user") || authenticated
        console.log(`GitHub user               │ ${user}`)

      //Base elements
        const base = {}
        let parts = (core.getInput("base") || "").split(",").map(part => part.trim())
        for (const part of conf.settings.plugins.base.parts)
          base[`base.${part}`] = parts.includes(part)
        console.log(`Base parts                │ ${parts.join(", ") || "(none)"}`)

      //Config
        const config = {
          "config.timezone":core.getInput("config_timezone") || ""
        }
        console.log(`Timezone                  │ ${config["config.timezone"] || "(system default)"}`)

      //Additional plugins
        const plugins = {
          lines:{enabled:bool(core.getInput("plugin_lines"))},
          traffic:{enabled:bool(core.getInput("plugin_traffic"))},
          pagespeed:{enabled:bool(core.getInput("plugin_pagespeed"))},
          habits:{enabled:bool(core.getInput("plugin_habits"))},
          languages:{enabled:bool(core.getInput("plugin_languages"))},
          followup:{enabled:bool(core.getInput("plugin_followup"))},
          music:{enabled:bool(core.getInput("plugin_music"))},
          posts:{enabled:bool(core.getInput("plugin_posts"))},
          isocalendar:{enabled:bool(core.getInput("plugin_isocalendar"))},
          gists:{enabled:bool(core.getInput("plugin_gists"))},
          topics:{enabled:bool(core.getInput("plugin_topics"))},
          projects:{enabled:bool(core.getInput("plugin_projects"))},
          tweets:{enabled:bool(core.getInput("plugin_tweets"))},
        }
        let q = Object.fromEntries(Object.entries(plugins).filter(([key, plugin]) => plugin.enabled).map(([key]) => [key, true]))
        console.log(`Plugins enabled           │ ${Object.entries(plugins).filter(([key, plugin]) => plugin.enabled).map(([key]) => key).join(", ")}`)
      //Additional plugins options
        //Pagespeed
          if (plugins.pagespeed.enabled) {
            plugins.pagespeed.token = core.getInput("plugin_pagespeed_token") || ""
            q[`pagespeed.detailed`] = bool(core.getInput(`plugin_pagespeed_detailed`))
            q[`pagespeed.screenshot`] = bool(core.getInput(`plugin_pagespeed_screenshot`))
            console.log(`Pagespeed token           │ ${/^MOCKED/.test(plugins.pagespeed.token) ? "(MOCKED)" : plugins.pagespeed.token ? "provided" : "missing"}`)
            console.log(`Pagespeed detailed        │ ${q["pagespeed.detailed"]}`)
            console.log(`Pagespeed screenshot      │ ${q["pagespeed.screenshot"]}`)
          }
        //Languages
          if (plugins.languages.enabled) {
            for (const option of ["ignored", "skipped"])
              q[`languages.${option}`] = core.getInput(`plugin_languages_${option}`) || null
            console.log(`Languages ignored         │ ${q["languages.ignored"] || "(none)"}`)
            console.log(`Languages skipped repos   │ ${q["languages.skipped"] || "(none)"}`)
          }
        //Habits
          if (plugins.habits.enabled) {
            for (const option of ["from", "days"])
              q[`habits.${option}`] = core.getInput(`plugin_habits_${option}`) || null
            q[`habits.facts`] = bool(core.getInput(`plugin_habits_facts`))
            q[`habits.charts`] = bool(core.getInput(`plugin_habits_charts`))
            console.log(`Habits facts              │ ${q["habits.facts"]}`)
            console.log(`Habits charts             │ ${q["habits.charts"]}`)
            console.log(`Habits events to use      │ ${q["habits.from"] || "(default)"}`)
            console.log(`Habits days to keep       │ ${q["habits.days"] || "(default)"}`)
          }
        //Music
          if (plugins.music.enabled) {
            plugins.music.token = core.getInput("plugin_music_token") || ""
            for (const option of ["provider", "mode", "playlist", "limit"])
              q[`music.${option}`] = core.getInput(`plugin_music_${option}`) || null
            console.log(`Music provider            │ ${q["music.provider"] || "(none)"}`)
            console.log(`Music plugin mode         │ ${q["music.mode"] || "(none)"}`)
            console.log(`Music playlist            │ ${q["music.playlist"] || "(none)"}`)
            console.log(`Music tracks limit        │ ${q["music.limit"] || "(default)"}`)
            console.log(`Music token               │ ${/^MOCKED/.test(plugins.music.token) ? "(MOCKED)" : plugins.music.token ? "provided" : "missing"}`)
          }
        //Posts
          if (plugins.posts.enabled) {
            for (const option of ["source", "limit"])
              q[`posts.${option}`] = core.getInput(`plugin_posts_${option}`) || null
            console.log(`Posts source              │ ${q["posts.source"] || "(none)"}`)
            console.log(`Posts limit               │ ${q["posts.limit"] || "(default)"}`)
          }
        //Isocalendar
          if (plugins.isocalendar.enabled) {
            q["isocalendar.duration"] = core.getInput("plugin_isocalendar_duration") || "half-year"
            console.log(`Isocalendar duration      │ ${q["isocalendar.duration"]}`)
          }
        //Topics
          if (plugins.topics.enabled) {
            for (const option of ["mode", "sort", "limit"])
              q[`topics.${option}`] = core.getInput(`plugin_topics_${option}`) || null
            console.log(`Topics mode               │ ${q["topics.mode"] || "(default)"}`)
            console.log(`Topics sort mode          │ ${q["topics.sort"] || "(default)"}`)
            console.log(`Topics limit              │ ${q["topics.limit"] || "(default)"}`)
          }
        //Projects
          if (plugins.projects.enabled) {
            for (const option of ["limit", "repositories"])
              q[`projects.${option}`] = core.getInput(`plugin_projects_${option}`) || null
            console.log(`Projects limit            │ ${q["projects.limit"] || "(default)"}`)
            console.log(`Projects repositories     │ ${q["projects.repositories"] || "(none)"}`)
          }
        //Tweets
          if (plugins.tweets.enabled) {
            plugins.tweets.token = core.getInput("plugin_tweets_token") || null
            for (const option of ["limit"])
              q[`tweets.${option}`] = core.getInput(`plugin_tweets_${option}`) || null
            console.log(`Twitter token             │ ${/^MOCKED/.test(plugins.tweets.token) ? "(MOCKED)" : plugins.tweets.token ? "provided" : "missing"}`)
            console.log(`Tweets limit              │ ${q["tweets.limit"] || "(default)"}`)
          }

      //Repositories to use
        const repositories = Number(core.getInput("repositories")) || 100
        console.log(`Repositories to use       │ ${repositories}`)

      //Die on plugins errors
        const die = bool(core.getInput("plugins_errors_fatal"))
        console.log(`Plugin errors             │ ${die ? "die" : "warn"}`)

      //Build query
        const query = JSON.parse(core.getInput("query") || "{}")
        console.log(`Query additional params   │ ${JSON.stringify(query)}`)
        q = {...query, ...q, base:false, ...base, ...config, repositories, template}

      //Render metrics
        const rendered = await metrics({login:user, q, dflags}, {graphql, rest, plugins, conf, die})
        console.log(`Render                    │ complete`)

      //Verify svg
        const verify = bool(core.getInput("verify"))
        console.log(`Verify SVG                │ ${verify}`)
        if (verify) {
          const [libxmljs] = [await import("libxmljs")].map(m => (m && m.default) ? m.default : m)
          const parsed = libxmljs.parseXml(rendered)
          if (parsed.errors.length)
            throw new Error(`Malformed SVG : \n${parsed.errors.join("\n")}`)
          console.log(`SVG valid                 │ yes`)
        }

      //Commit to repository
        const dryrun = bool(core.getInput("dryrun"))
        if (dryrun)
          console.log(`Dry-run                   │ complete`)
        else {
          //Repository and branch
            const branch = github.context.ref.replace(/^refs[/]heads[/]/, "")
            console.log(`Repository                │ ${github.context.repo.owner}/${github.context.repo.repo}`)
            console.log(`Branch                    │ ${branch}`)
          //Committer token
            const token = core.getInput("committer_token") || core.getInput("token") || ""
            console.log(`Committer token           │ ${/^MOCKED/.test(token) ? "(MOCKED)" : token ? "provided" : "missing"}`)
            if (!token)
              throw new Error("You must provide a valid GitHub token to commit your metrics")
            const rest = github.getOctokit(token)
            console.log(`Committer REST API        │ ok`)
            try {
              console.log(`Committer                 │ ${(await rest.users.getAuthenticated()).data.login}`)
            }
            catch {
              console.log(`Committer                 │ (github-actions)`)
            }
          //Retrieve previous render SHA to be able to update file content through API
            let sha = null
            try {
              const {repository:{object:{oid}}} = await graphql(`
                  query Sha {
                    repository(owner: "${github.context.repo.owner}", name: "${github.context.repo.repo}") {
                      object(expression: "${branch}:${filename}") { ... on Blob { oid } }
                    }
                  }
                `
              )
              sha = oid
            } catch (error) { console.debug(error) }
            console.log(`Previous render sha       │ ${sha ?? "(none)"}`)
          //Update file content through API
            await rest.repos.createOrUpdateFileContents({
              ...github.context.repo, path:filename, message:`Update ${filename} - [Skip GitHub Action]`,
              content:Buffer.from(rendered).toString("base64"),
              ...(sha ? {sha} : {})
            })
            console.log(`Commit to repo            │ ok`)
        }

      //Success
        console.log(`Success, thanks for using metrics !`)
        process.exit(0)

    }
  //Errors
    catch (error) {
      console.error(error)
      if (!bool(core.getInput("debug")))
        for (const log of ["─".repeat(64), "An error occured, logging debug message :", ...debugged])
          console.log(log)
      core.setFailed(error.message)
      process.exit(1)
    }
})()).catch(error => process.exit(1))