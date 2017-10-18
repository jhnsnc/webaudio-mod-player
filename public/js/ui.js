/*
  user interface stuff for the web audio module player
  (c) 2012-2015 firehawk/tda
*/

var stats;

var musicPath = '/mods/';
var musicLibrary = [];

var $mainContainer;
var $patternVisualization, patterns;
var $channelVisualization, $channelsList, $samplesList;
var $modTitle, $modInfo, $timingContainer;
// var $btnPrevTrack, $btnNextTrack;
var $btnBack, $btnForward, $btnPlay, $btnPause;
var $btnRepeat, $btnStereo, $btnAmigaFilter, $btnVisualizerMode, $btnShowLoadDialog;
var $btnLoadSelection;

function showLoaderInfo(module) {
  // TODO: change to an event listener approach
  window.loaderInterval=setInterval(function(){
    if (module.loading) {
      $timingContainer.html(module.state);
    } else {
      clearInterval(window.loaderInterval);
    }
  }, 20);
}

var oldpos = -1, oldrow = -1;
var lastframe = -1;
function updateUI(timestamp) {
  // console.log('update UI');

  // maintain 25hz frame rate for the UI
  if ((timestamp-lastframe) < 40) {
    requestAnimationFrame(updateUI);
    return;
  }

  stats.begin(); // stats

  lastframe = timestamp;

  var i, c;

  if (module.playing) {
    if (window.moduleVis == 2) {
      // update channel visualization
      for(ch=0; ch<module.channels; ch++) {
        $channelsList[ch].eq.get(0).dataset.level = Math.round(module.chvu[ch]*20);
        $channelsList[ch].sampleId.html(formatHex(module.currentsample(ch)+1, 2));
        $channelsList[ch].sampleName.html(formatUiString(module.samplenames[module.currentsample(ch)], 28));
        $channelVisualization.append($channelsList[ch].el);
      }
    } else if (window.moduleVis == 1) {
      // update pattern visualization
      if (oldpos>=0 && oldrow>=0) $('.currentrow').removeClass('currentrow');
      patterns[module.currentpattern()].rows.eq(module.row).addClass('currentrow');
      patterns[module.currentpattern()].el.scrollTop(module.row*16);
      if (oldpos != module.position) {
        if (oldpos>=0) $('.currentpattern').removeClass('currentpattern');
        patterns[module.currentpattern()].el.addClass('currentpattern');
      }
    }

    if (oldrow != module.row || oldpos != module.position) {
      // update timing
      $timingContainer.html(renderTimingBar(module));
      // update samples
      $samplesList.forEach(el => { el.removeClass('activesample'); });
      for(c=0; c<module.channels; c++)
        if (module.noteon(c))
          $samplesList[module.currentsample(c)].addClass('activesample');
    }

    oldpos = module.position;
    oldrow = module.row;
  }

  if (module.playing) {
    requestAnimationFrame(updateUI);
  }
  stats.end(); // stats
}


$(document).ready(function() {
  var i;

  // setup stats
  stats = new Stats();
  stats.showPanel(0);
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = stats.domElement.style.top = 0;
  document.body.appendChild(stats.domElement);

  // cache UI elements
  $mainContainer = $('#innercontainer');

  $patternVisualization = $('#modpattern');
  patterns = [];
  $channelVisualization = $('#modchannels');
  $channelsList = [];
  $samplesList = [];

  $modTitle = $('#modtitle');
  $modInfo = $('#modinfo');
  $timingContainer = $('#modtimer');

  // $btnPrevTrack = $('#prev_track');
  // $btnNextTrack = $('#next_track');
  $btnBack = $('#go_back');
  $btnForward = $('#go_fwd');
  $btnPlay = $('#play');
  $btnPause = $('#pause');

  $btnRepeat = $('#modrepeat');
  $btnStereo = $('#modpaula');
  $btnVisualizerMode = $('#modvis');
  $btnAmigaFilter = $('#modamiga');
  $btnShowLoadDialog = $('#load_song');

  $btnLoadSelection = $('#load');

  // setup samples list
  var el;
  for (i=0; i<31; i++) {
    el = $(`<div class=\"samplelist\" id=\"sample${formatHex(i+1,2)}\">${formatHex(i+1,2)} ${formatUiString('', 28)}</div>`);
    $samplesList.push(el);
    $('#modsamples').append(el);
  }

  // playlist
  setupPlaylistUi(); // TODO: move to bottom of ready function

  // set up module player
  window.module=new Modplayer();
  window.playlistPosition=0;
  window.playlistActive=false;

  setVisualization(null, 1);

  loadPreferencesFromStorage();

  // module playback events
  module.addEventListener('ready', handleModuleReady);
  module.addEventListener('play', handleModulePlay);
  module.addEventListener('stop', handleModuleStop);

  // button actions
  $btnPlay.click(function(){
    if (module.playing) {
      module.stop();
      $btnPause.removeClass('down');
    } else {
      module.play();
    }
  });
  $btnPause.click(() => { $btnPause.toggleClass('down'); module.pause(); });
  $btnBack.click(() => { module.jump(-1); });
  $btnForward.click(() => { module.jump(1); });
  $btnRepeat.click(() => {
    var val = $btnRepeat.get(0).classList.toggle('down');
    module.setrepeat(val);
    savePreference('modrepeat', val);
  });
  $btnStereo.click(toggleStereo);
  $btnVisualizerMode.click(() => {
    var val = (window.moduleVis + 1) % 3;
    setVisualization(module, val);
    savePreference('modvis', val);
  });
  $btnAmigaFilter.click(function() {
    if ($btnAmigaFilter.get(0).classList.toggle('down')) {
      module.setamigamodel('500');
      savePreference('modamiga', '500');
    } else {
      module.setamigamodel('1200');
      savePreference('modamiga', '1200');
    }
  });

  $(document).keyup(handleKeyboardInput);

  // load track list and preload random song
  loadMusicLibraryFromJson(true);
});

function handleModuleReady() {
  console.log('module ready');

  $modTitle.html(formatUiString(module.title, 28));

  // set samples
  $samplesList.forEach((el, idx) => {
    el.html(idx<module.samplenames.length ? `${formatHex(idx+1,2)} ${formatUiString(module.samplenames[idx], 28)}` : `${formatHex(idx+1,2)} ${formatUiString('', 28)}`);
  });

  $modInfo.html("");
  $modInfo.append("('"+module.signature+"')");
  var s=window.currentModule.split("/");
  var titleString;
  if (s.length > 1) {
    titleString = s[1]+" - module player for Web Audio";
    document.title = titleString;
    window.history.pushState('', titleString, "/?composer="+s[0]+"&track="+s[1]);
  } else {
    titleString = s[0]+" - module player for Web Audio";
    document.title = titleString;
    window.history.pushState('', titleString, "/?track="+s[0]);
  }

  if (window.playlistActive) {
    $btnPrevTrack.removeClass("inactive");
    $btnNextTrack.removeClass("inactive");
  } else {
    $btnPrevTrack.addClass("inactive");
    $btnNextTrack.addClass("inactive");
  }

  $patternVisualization.html(renderPatternData(module.patterns, module.channels, module.patterndata, module));
  patterns = [];
  $patternVisualization.find('.patterndata').each((idx, el) => {
    patterns.push({
      el: $(el),
      rows: $(el).find('.patternrow')
    });
  });
  $timingContainer.html('ready.');
}

function handleModulePlay() {
  console.log('module play');

  // setup channel details
  var ch, i, el;
  $channelsList = [];
  var eqStr = '';
  for(i=1; i<=20; i++) {
    eqStr += `<span class="pip-${i}">&#x00BB;</span>`;
  }
  for(ch=0; ch<module.channels; ch++) {
    el = $(`<span class="channel-details"><span class="channelnr">${formatHex(ch,2)}</span> [<span class="eq">${eqStr}</span>] `+
      `<span class="hl sample-id">${formatHex(0,2)}</span>:<span class="sample-name">${formatUiString('', 28)}</span></span>`);
    $channelsList.push({
      el: el,
      eq: el.find('.eq'),
      sampleId: el.find('.sample-id'),
      sampleName: el.find('.sample-name'),
    });
  }
  $channelVisualization.empty();
  $channelVisualization.append('<br/>');
  for(ch=0; ch<module.channels; ch++) {
    $channelsList[ch].eq.get(0).dataset.level = 0;
    $channelsList[ch].sampleId.html(formatHex(module.currentsample(ch)+1, 2));
    $channelsList[ch].sampleName.html(formatUiString(module.samplenames[module.currentsample(ch)], 28));
    $channelVisualization.append($channelsList[ch].el);
  }

  // play
  $btnPlay.html('[stop]');
  if (!module.paused) {
    $btnPause.removeClass('down');
  }
  requestAnimationFrame(updateUI);
}

function handleModuleStop() {
  console.log('module stop');

  $samplesList.forEach(el => { el.removeClass('activesample'); });

  // clear channels visualization
  $channelVisualization.empty();
  $channelsList = [];

  $(".currentpattern").removeClass("currentpattern");
  $timingContainer.html("stopped");
  $btnPlay.html("[play]");

  // if in playlist mode, load next song
  if (window.playlistActive && module.endofsong) {
    var opt=$("#playlist_box option:selected");
    if (opt.length) {
      var n=$(opt).next("option");
      if (n.length) {
        // load next track
      } else {
        // jump to first
        n=$("#playlist_box option:first");
      }
      $("#playlist_box").val($(n).val()).change();
      playFromPlaylist(module, true);
    }
  }
}

function toggleStereo() {
  if ($btnStereo.hasClass('down')) {
    if ($btnStereo.hasClass('stereo')) {
      $btnStereo.toggleClass('stereo');
      $btnStereo.toggleClass('down');
      // mono
      $btnStereo.html('[mono]');
      module.setseparation(2);
      savePreference('modpaula', 2);
    } else {
      $btnStereo.toggleClass('stereo');
      // normal stereo
      $btnStereo.html('[))((]');
      module.setseparation(0);
      savePreference('modpaula', 0);
    }
  } else {
    $btnStereo.toggleClass('down');
    // narrow stereo
    $btnStereo.html('[)oo(]');
    module.setseparation(1);
    savePreference('modpaula', 1);
  }
}

function setVisualization(mod, val) {
  var visNames = ['[none]', '[trks]', '[chvu]'];
  switch (val) {
    case 0: // show none
      $btnVisualizerMode.removeClass('down');
      $('.currentpattern').removeClass('currentpattern');
      $channelVisualization.hide();
      break;

    case 1: // show pattern data
      $btnVisualizerMode.addClass('down');
      if (mod && mod.playing) patterns[module.currentpattern()].el.addClass('currentpattern');
      $channelVisualization.hide();
      break;

    case 2: // show channel output
      $btnVisualizerMode.addClass('down');
      $('.currentpattern').removeClass('currentpattern');
      $channelVisualization.show();
      break;
  }
  $btnVisualizerMode.html(visNames[val]);
  window.moduleVis = val;
}
