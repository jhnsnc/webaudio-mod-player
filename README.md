# webaudio-mod-player

This is a Protracker module player implemented in JavaScript using the Web Audio API. It supports standard 4-channel Amiga Protracker modules, as well as 6- and 8-channel PC FastTracker modules. Multichannel modules also work, although mod.dope ('28CH') has only been tested with.

This app can be found live here: [http://webaudio-mod-player.mybluemix.net/](http://webaudio-mod-player.mybluemix.net/)

The player supports most Protracker effects, including the 'LED filter' command. Some effects still need work, though (try playing mod.black_queen by Dreamer - pattern loops fail spectacularly).

Copyrights:

- Protracker module player for Web Audio (c) 2012-2014 Jani Halme
  * modified by Chris Johnson (2015)
- Topaz TTF font (c) 2009 dMG of Trueschool and Divine Stylers

# Setup

Note that this repo does not include any MOD files. You will need to find your own MOD files and add them to the `client-src/mods/` subdirectory. MOD files should be organized in folders by artist and named by song title. For example, a song titled "Overload" by "Mantronix and Tip" would be added to `client-src/mods/Mantronix_and_Tip/overload.mod`.

## Local Build

1. Clone [this webaudio-mod-player repo](https://github.com/jhnsnc/webaudio-mod-player)
2. [Install NodeJS](https://nodejs.org/)
3. Open a terminal and point it at the project directory
4. Add MOD files to the `client-src/mods/` subdirectory
5. Run `npm install`
  * this will install node dependencies
  * it should also run `gulp build` to create the `public/` directory
6. Run `node bin/www` to launch the server, which you can then access at [http://localhost:6001](http://localhost:6001)

## Develop

* `gulp build-debug` will build the `public/` directory with uncompressed assets for easier development
* `gulp watch` will look for changes in the `client-src/` directory and rebuild assets as needed
* You may find it more convenient to use [nodemon](https://www.npmjs.com/package/nodemon) to launch the server while developing
  1. Install nodemon by running `npm install -g nodemon`
  2. Run the server with nodemon: `nodemon bin/www`
  3. The server will now update whenever project files are modified (no need to restart the node server)
* Once the server is running, access it at [http://localhost:6001](http://localhost:6001)
  - As noted above, you will need to add your own MOD files to the `client-src/mods/` subdirectory

## Deploy

This project is currently set up to be easily deployed on [Bluemix](https://bluemix.net), though it could easily be modified to deploy elsewhere.

The `.cfignore` and `manifest.yml` files deal with Bluemix deployment. To deploy on Bluemix, set up a new app through your dashboard, then modify the `manifest.yml` file appropriately, and use the [Cloud Foundry CLI to push the app live](https://www.ng.bluemix.net/docs/starters/upload_app.html) (`cf push`).
