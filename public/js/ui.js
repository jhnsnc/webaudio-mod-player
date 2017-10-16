/*
  user interface stuff for the web audio module player
  (c) 2012-2015 firehawk/tda
*/

var musicPath = '/mods/';
var musicLibrary = [];

var $mainContainer;

var $patternVisualization;
var $channelVisualization;
var $samplesList;

var $modTitle;
var $modInfo;
var $timingContainer;

// var $btnPrevTrack;
// var $btnNextTrack;
var $btnBack;
var $btnForward;
var $btnPlay;
var $btnPause;

var $btnRepeat;
var $btnStereo;
var $btnAmigaFilter;
var $btnVisualizerMode;
var $btnShowLoadDialog;

var $btnLoadSelection;

function cacheUiElements() {
  $mainContainer = $('#innercontainer');

  $patternVisualization = $('#modpattern');
  $channelVisualization = $('#modchannels');
  $samplesList = $('#modsamples');

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
}

function showLoaderInfo(module)
{
  window.loaderInterval=setInterval(function(){
    if (module.loading) {
      $timingContainer.html(module.state);
    } else {
      clearInterval(window.loaderInterval);
    }
  }, 20);
}

function addToPlaylist(song)
{
  var dupe=false;
  $("#playlist_box option").each(function(o) {
    if ($(this).val() == song) dupe=true;
  });
  if (!dupe) {
    var optclass=($("#playlist_box option").length & 1) ? "odd" : "even";
    $("#playlist_box").append("<option class=\""+optclass+"\" value=\""+song+"\">"+song+"</option>");
  }
  return !dupe;
}

function refreshStoredPlaylist()
{
  if(typeof(Storage) !== "undefined") {
    var playlist=[];
    $("#playlist_box option").each(function(o) {
      playlist.push($(this).val());
    });
    localStorage["playlist"]=JSON.stringify(playlist);
  }
}


function setVisualization(mod, v)
{
  var visNames=['[none]', '[trks]', '[chvu]'];
  switch (v) {
    case 0: // show none
      $btnVisualizerMode.removeClass("down");
      $(".currentpattern").removeClass("currentpattern");
      $channelVisualization.hide();
      break;

    case 1: // show pattern data
      $btnVisualizerMode.addClass("down");
      if (mod && mod.playing) $("#pattern"+formatHex(mod.currentpattern(),2)).addClass("currentpattern");
      $channelVisualization.hide();
      break;

    case 2: // show channel output
      $btnVisualizerMode.addClass("down");
      $(".currentpattern").removeClass("currentpattern");
      $channelVisualization.show();
      break;
  }
  $btnVisualizerMode.html(visNames[v]);
  window.moduleVis=v;
}


var oldpos=-1, oldrow=-1;

var lastframe=-1;
function updateUI(timestamp)
{
  // maintain 25hz frame rate for the UI
  if ((timestamp-lastframe) < 40) {
    requestAnimationFrame(updateUI);
    return;
  }
  lastframe=timestamp;

  var i,c;
  var mod=window.module;

  if (mod.playing) {
    if (window.moduleVis==2) {
      var txt, txt0="<br/>", txt1="<br/>";
      for(ch=0;ch<mod.channels;ch++) {
        txt='<span class="channelnr">'+formatHex(ch,2)+'</span> ['+renderChannelLevel(mod.chvu[ch])+'] '+
            '<span class="hl">'+formatHex(mod.currentsample(ch),2)+'</span>:<span class="channelsample">'+formatUiString(mod.samplenames[mod.currentsample(ch)], 28)+"</span><br/>";
        if (ch&1) txt0+=txt; else txt1+=txt;
      }
      $("#even-channels").html(txt0);
      $("#odd-channels").html(txt1);
    } else if (window.moduleVis==1) {
      if (oldpos>=0 && oldrow>=0) $(".currentrow").removeClass("currentrow");
      $("#pattern"+formatHex(mod.currentpattern(),2)+"_row"+formatHex(mod.row,2)).addClass("currentrow");
      $("#pattern"+formatHex(mod.currentpattern(),2)).scrollTop(mod.row*16);
      if (oldpos != mod.position) {
        if (oldpos>=0) $(".currentpattern").removeClass("currentpattern");
        $("#pattern"+formatHex(mod.currentpattern(),2)).addClass("currentpattern");
      }
    }

    if (oldrow != mod.row || oldpos != mod.position) {
      $timingContainer.replaceWith("<span id=\"modtimer\">"+
        "pos <span class=\"hl\">"+formatHex(mod.position,2)+"</span>/<span class=\"hl\">"+formatHex(mod.songlen,2)+"</span> "+
        "row <span class=\"hl\">"+formatHex(mod.row,2)+"</span>/<span class=\"hl\">"+formatHex(mod.currentpattlen()-1,2)+"</span> "+
        "speed <span class=\"hl\">"+mod.speed+"</span> "+
        "bpm <span class=\"hl\">"+mod.bpm+"</span> "+
        "filter <span class=\"hl\">"+(mod.filter ? "on" : "off")+"</span>"+
        "</span>");

      $samplesList.children().removeClass("activesample");
      for(c=0;c<mod.channels;c++)
        if (mod.noteon(c)) $("#sample"+formatHex(mod.currentsample(c)+1,2)).addClass("activesample");
    }
    oldpos=mod.position;
    oldrow=mod.row;
  }
  requestAnimationFrame(updateUI);
}


$(document).ready(function() {
  // cache UI elements
  cacheUiElements();

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
  $modTitle.html(formatUiString(module.title, 28));
  $samplesList.html("");
  for(i=0;i<31;i++)
    $samplesList.append("<span class=\"samplelist\" id=\"sample"+formatHex(i+1,2)+"\">"+formatHex(i+1,2)+" "+formatUiString(module.samplenames[i], 28)+"</span>\n");
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
  $timingContainer.html("ready.");
}

function handleModulePlay() {
  $btnPlay.html("[stop]");
  if (!module.paused) $btnPause.removeClass("down");
  requestAnimationFrame(updateUI);
}

function handleModuleStop() {
  $samplesList.children().removeClass("activesample");
  $("#even-channels").html("");
  $("#odd-channels").html("");
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
