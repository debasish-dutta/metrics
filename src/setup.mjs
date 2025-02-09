//Imports
  import fs from "fs"
  import path from "path"
  import util from "util"

/** Setup */
  export default async function ({log = true} = {}) {

    //Init
      const logger = log ? console.debug : () => null
      logger(`metrics/setup > setup`)
      const templates = "src/templates"
      const queries = "src/queries"
      const conf = {
        templates:{},
        queries:{},
        settings:{},
        statics:path.resolve("src/html"),
        node_modules:path.resolve("node_modules"),
      }

    //Load settings
      logger(`metrics/setup > load settings.json`)
      if (fs.existsSync(path.resolve("settings.json"))) {
        conf.settings = JSON.parse(`${await fs.promises.readFile(path.resolve("settings.json"))}`)
        logger(`metrics/setup > load settings.json > success`)
      }
      else
        logger(`metrics/setup > load settings.json > (missing)`)
      if (!conf.settings.templates)
        conf.settings.templates = {default:"classic", enabled:[]}
      if (!conf.settings.plugins)
        conf.settings.plugins = {}
      conf.settings.plugins.base = {parts:["header", "activity", "community", "repositories", "metadata"]}
      if (conf.settings.debug)
        logger(util.inspect(conf.settings, {depth:Infinity, maxStringLength:256}))

    //Load package settings
      logger(`metrics/setup > load package.json`)
      conf.package = JSON.parse(`${await fs.promises.readFile(path.resolve("package.json"))}`)
      logger(`metrics/setup > load package.json > success`)

    //Load templates
      for (const name of await fs.promises.readdir(templates)) {
        //Cache templates
          if (/.*[.]mjs$/.test(name))
            continue
          logger(`metrics/setup > load template [${name}]`)
          const files = [
            `${templates}/${name}/image.svg`,
            `${templates}/${name}/style.css`,
            `${templates}/${name}/fonts.css`,
          ].map(file => fs.existsSync(path.resolve(file)) ? file : file.replace(`${templates}/${name}/`, `${templates}/classic/`)).map(file => path.resolve(file))
          const [image, style, fonts] = await Promise.all(files.map(async file => `${await fs.promises.readFile(file)}`))
          conf.templates[name] = {image, style, fonts}
          logger(`metrics/setup > load template [${name}] > success`)
        //Debug
          if (conf.settings.debug) {
            Object.defineProperty(conf.templates, name, {
              get() {
                logger(`metrics/setup > reload template [${name}]`)
                const [image, style, fonts] = files.map(file => `${fs.readFileSync(file)}`)
                logger(`metrics/setup > reload template [${name}] > success`)
                return {image, style, fonts}
              }
            })
          }
      }

    //Load queries
      for (const query of await fs.promises.readdir(queries)) {
        //Cache queries
          const name = query.replace(/[.]graphql$/, "")
          logger(`metrics/setup > load query [${name}]`)
          conf.queries[`_${name}`] = `${await fs.promises.readFile(path.resolve(`${queries}/${query}`))}`
          logger(`metrics/setup > load query [${name}] > success`)
        //Debug
          if (conf.settings.debug) {
            Object.defineProperty(conf.queries, `_${name}`, {
              get() {
                logger(`metrics/setup > reload query [${name}]`)
                const raw = `${fs.readFileSync(path.resolve(`${queries}/${query}`))}`
                logger(`metrics/setup > reload query [${name}] > success`)
                return raw
              }
            })
          }
      }

    //Create queries formatters
      Object.keys(conf.queries).map(name => conf.queries[name.substring(1)] = (vars = {}) => {
        let query = conf.queries[name]
        for (const [key, value] of Object.entries(vars))
          query = query.replace(new RegExp(`[$]${key}`, "g"), value)
        return query
      })

    //Conf
      logger(`metrics/setup > setup > success`)
      return conf

  }