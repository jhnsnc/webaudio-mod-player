function loadPreferencesFromStorage() {
  if(typeof(Storage) !== 'undefined') {
    // read previous button states from localStorage
    if (localStorage['modrepeat']) {
      if (localStorage['modrepeat']=='true') {
        $btnRepeat.addClass('down');
        module.setrepeat(true);
      } else {
        $btnRepeat.removeClass('down');
        module.setrepeat(false);
      }
    }
    if (localStorage['modamiga']) {
      if (localStorage['modamiga']=='500') {
        $btnAmigaFilter.addClass('down');
        module.setamigamodel('500');
      } else {
        $btnAmigaFilter.removeClass('down');
        module.setamigamodel('1200');
      }
    }
    if (localStorage['modpaula']) {
      switch (parseInt(localStorage['modpaula'])) {
        case 0: // stereo
          $btnStereo.addClass('stereo');
          $btnStereo.addClass('down');
          $btnStereo.html('[))((]');
          module.setseparation(0);
          break;
        case 1: // blend
          $btnStereo.removeClass('stereo');
          $btnStereo.addClass('down');
          $btnStereo.html('[)oo(]');
          module.setseparation(1);
          break;
        case 2: // mono
          $btnStereo.removeClass('stereo');
          $btnStereo.removeClass('down');
          $btnStereo.html('[mono]');
          module.setseparation(2);
          break;
      }
    }
    if (localStorage['playlist']) {
      var playlist=JSON.parse(localStorage['playlist']);
      for(i=0;i<playlist.length;i++) addToPlaylist(playlist[i]);
    }
    if (localStorage['modvis'])
      setVisualization(null, parseInt(localStorage['modvis']));
  }
}


function savePreference(preference, val) {
  if( typeof(Storage) !== 'undefined') {
    localStorage.setItem(preference, val);
  }
}


function handleKeyboardInput(evt) {
  // keyboard shortcuts for main player screen
  if ($mainContainer.is(':visible')) {
    if (evt.keyCode==32) { // start/pause playback with space
      if (module.playing) {
        $btnPause.click();
      } else {
        $btnPlay.click();
      }
      evt.preventDefault(); return false;
    }
    if (evt.keyCode==76) { // 'L' to open loading screen
      $btnShowLoadDialog.click();
      evt.preventDefault(); return false;
    }
    if (evt.keyCode==37) { // left to jump to previous order
      $btnBack.click();
      evt.preventDefault(); return false;
    }
    if (evt.keyCode==39) { // right to jump to next order
      $btnForward.click();
      evt.preventDefault(); return false;
    }
  }

  // keyboard shortcuts for load/playlist screen
  if ($('#loadercontainer').is(':visible')) {
    if (evt.keyCode==27) {
      $('#load_cancel').click();
      evt.preventDefault(); return false;
    }
  }
}


function loadMusicLibraryFromJson(autoloadTrack) {
  // all done, load the song library and default module
  var request = new XMLHttpRequest();
  request.open('GET', '/mods/library.json', true);
  request.responseType = 'json';
  request.onload = function() {
    window.musicLibrary = request.response;
    updateSelectBox(null);

    console.log('autoload! ', autoloadTrack);
    if (typeof autoloadTrack === 'string') {
      playTrack(autoloadTrack, false);
    } else if (typeof autoloadTrack === 'boolean' && autoloadTrack) {
      playRandomTrack(false);
    }
  }
  request.send();
}

function playFromPlaylist(module, autostart) {
  window.currentModule = $("#playlist_box option:selected").val();
  window.playlistPosition = $("#playlist_box option").index($("#playlist_box option:selected"));
  window.playlistActive = true;
  playTrack(window.currentModule);
}

var playRandomTrack = autostart => { playTrack(getRandomTrack(), autostart); };

function playTrack(selection, autostart) {
  if (module.playing) {
    module.stopaudio();
  }
  module.setautostart(autostart);

  var loadInterval = setInterval(function() {
    if (!module.delayload) {
      window.currentModule = selection;
      module.load(musicPath+selection);
      clearInterval(loadInterval);
      showLoaderInfo(module);
    }
  }, 200);
}

function getRandomTrack() {
  // get a full list of all tracks
  let allTracks = [];
  musicLibrary.forEach(composerData => {
    allTracks = allTracks.concat(composerData.songs.map(songData => `${composerData.composer}/${songData.file}`));
  });
  // return a random one
  return allTracks[Math.floor(Math.random()*allTracks.length)];
}
