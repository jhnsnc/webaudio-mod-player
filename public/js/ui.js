/*
  user interface stuff for the web audio module player
  (c) 2012-2015 firehawk/tda
*/

var musicPath = '/mods/';
var musicLibrary = [];

var $patternVisualization;
var $channelVisualization;
var $samplesList;

var $modTitle;
var $modInfo;
var $timingContainer;

var $btnPrevTrack;
var $btnNextTrack;
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
  $patternVisualization = $('#modpattern');
  $channelVisualization = $('#modchannels');
  $samplesList = $('#modsamples');

  $modTitle = $('#modtitle');
  $modInfo = $('#modinfo');
  $timingContainer = $('#modtimer');

  $btnPrevTrack = $('#prev_track');
  $btnNextTrack = $('#next_track');
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

function playFromPlaylist(module, autostart)
{
  module.stopaudio();
  module.setautostart(autostart);
  var loadInterval=setInterval(function(){
    if (!module.delayload) {
       window.currentModule=$("#playlist_box option:selected").val();
       window.playlistPosition=$("#playlist_box option").index($("#playlist_box option:selected"));
       window.playlistActive=true;
       module.load(musicPath+$("#playlist_box option:selected").val());
       clearInterval(loadInterval);
       showLoaderInfo(module);
    }
  }, 200);
}

function updateSelectBox(e)
{
  var i, j, f, o="";

  var filter=$("#loadfilter").val().toLowerCase();
  for(i=0;i<window.musicLibrary.length;i++) {
    og=""; f=0;
    if (window.musicLibrary[i].composer=="Unknown") {
      og+='<optgroup class="'+((i&1)?"odd":"even")+'" label="'+window.musicLibrary[i].composer+'">';
      for(j=0;j<window.musicLibrary[i].songs.length;j++) {
        if (filter=="" || window.musicLibrary[i].songs[j].file.toLowerCase().indexOf(filter)>=0) {
          og+='<option class="'+((i&1)?"odd":"even")+'" value="'+
            window.musicLibrary[i].songs[j].file+'">'+window.musicLibrary[i].songs[j].file+' '+
            '<span class="filesize">('+window.musicLibrary[i].songs[j].size+' bytes)</span></option>';
          f++;
        }
      }
      og+='</optgroup>';
    } else {
      og+='<optgroup class="'+((i&1)?"odd":"even")+'" label="'+window.musicLibrary[i].composer+'">';
      for(j=0;j<window.musicLibrary[i].songs.length;j++) {
        if (filter=="" ||
           window.musicLibrary[i].composer.toLowerCase().indexOf(filter)>=0 ||
           window.musicLibrary[i].songs[j].file.toLowerCase().indexOf(filter)>=0) {
          og+='<option class="'+((i&1)?"odd":"even")+'" value="'+window.musicLibrary[i].composer+'/'+
            window.musicLibrary[i].songs[j].file+'">'+window.musicLibrary[i].songs[j].file+' '+
            '<span class="filesize">('+window.musicLibrary[i].songs[j].size+' bytes)</span></option>';
          f++;
        }
      }
      og+='</optgroup>';
    }
    if (f) o+=og;
  }
  $("#modfile").html(o);
  $("#modfile option").dblclick(function() {
    $btnLoadSelection.click();
  });
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

  // set up module player
  window.module=new Modplayer();
  window.playlistPosition=0;
  window.playlistActive=false;

  setVisualization(null, 1);

  if(typeof(Storage) !== "undefined") {
    // read previous button states from localStorage
    if (localStorage["modrepeat"]) {
      if (localStorage["modrepeat"]=="true") {
        $btnRepeat.addClass("down");
        module.setrepeat(true);
      } else {
        $btnRepeat.removeClass("down");
        module.setrepeat(false);
      }
    }
    if (localStorage["modamiga"]) {
      if (localStorage["modamiga"]=="500") {
        $btnAmigaFilter.addClass("down");
        module.setamigamodel("500");
      } else {
        $btnAmigaFilter.removeClass("down");
        module.setamigamodel("1200");
      }
    }
    if (localStorage["modpaula"]) {
      switch (parseInt(localStorage["modpaula"])) {
        case 0:
        $btnStereo.addClass("stereo");
        $btnStereo.addClass("down");
        $btnStereo.html("[))((]");
        module.setseparation(0);
        break;

        case 1:
        $btnStereo.removeClass("stereo");
        $btnStereo.addClass("down");
        $btnStereo.html("[)oo(]");
        module.setseparation(1);
        break;

        case 2:
        $btnStereo.removeClass("stereo");
        $btnStereo.removeClass("down");
        $btnStereo.html("[mono]");
        module.setseparation(2);
        break;
      }
    }
    if (localStorage["playlist"]) {
      var playlist=JSON.parse(localStorage["playlist"]);
      for(i=0;i<playlist.length;i++) addToPlaylist(playlist[i]);
    }
    if (localStorage["modvis"])
      setVisualization(null, parseInt(localStorage["modvis"]));
  }

  module.addEventListener('ready', function() {
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
  });

  module.addEventListener('play', function() {
    $btnPlay.html("[stop]");
    if (!module.paused) $btnPause.removeClass("down");
    requestAnimationFrame(updateUI);
  });

  module.addEventListener('stop', function() {
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
  });

  $btnPlay.click(function(){
    if (module.playing) {
      module.stop();
      $btnPause.removeClass("down");
      return false;
    }
    module.play();
    return false;
  });

  $btnPause.click(function(){
      $btnPause.toggleClass("down");
      module.pause();
      return false;
  });

  $btnBack.click(function(){
    module.jump(-1);
    return false;
  });

  $btnForward.click(function(){
    module.jump(1);
    return false;
  });

  $btnRepeat.click(function(){
    $btnRepeat.toggleClass("down");
    module.setrepeat($btnRepeat.hasClass("down"));
    if(typeof(Storage) !== "undefined") localStorage.setItem("modrepeat", $btnRepeat.hasClass("down"));
    return false;
  });

  $btnStereo.click(function() {
    if ($btnStereo.hasClass("down")) {
      if ($btnStereo.hasClass("stereo")) {
        $btnStereo.toggleClass("stereo");
        $btnStereo.toggleClass("down");
        // mono
        $btnStereo.html("[mono]");
        module.setseparation(2);
        if(typeof(Storage) !== "undefined") localStorage.setItem("modpaula", 2);
      } else {
        $btnStereo.toggleClass("stereo");
        // normal stereo
        $btnStereo.html("[))((]");
        module.setseparation(0);
        if(typeof(Storage) !== "undefined") localStorage.setItem("modpaula", 0);
      }
    } else {
      $btnStereo.toggleClass("down");
      // narrow stereo
      $btnStereo.html("[)oo(]");
      module.setseparation(1);
      if(typeof(Storage) !== "undefined") localStorage.setItem("modpaula", 1);
    }
    return false;
  });

  $btnVisualizerMode.click(function() {
    var v=(window.moduleVis+1)%3;
    setVisualization(module, v);
    if(typeof(Storage) !== "undefined") localStorage.setItem("modvis", v);
    return false;
  });

  $btnAmigaFilter.click(function() {
    $btnAmigaFilter.toggleClass("down");
    if ($btnAmigaFilter.hasClass("down")) {
      module.setamigamodel("500");
      if(typeof(Storage) !== "undefined") localStorage.setItem("modamiga", "500");
    } else {
      module.setamigamodel("1200");
      if(typeof(Storage) !== "undefined") localStorage.setItem("modamiga", "1200");
    }
  });

  $btnShowLoadDialog.click(function(){
    $("#loadercontainer").show();
    $("#innercontainer").hide();
    $("#modfile").focus();
    var s=document.getElementById("modfile");
    var i=s.selectedIndex;
    s[i].selected=false;
    s[(i<(s.length-12))?(i+12):(s.length-1)].selected=true;
    s[i].selected=true;
    return false;
  });

  $("#loadercontainer").click(function(){
    return false;
  });

  $btnLoadSelection.click(function(){
    if (module.playing) {
      module.stop();
      module.setautostart(true);
    } else {
      module.setautostart(false);
    }
    $("#loadercontainer").hide();
    $("#innercontainer").show();
    var loadInterval=setInterval(function(){
      if (!module.delayload) {
         window.currentModule=$("#modfile").val();
         window.playlistActive=false;
         module.load(musicPath+$("#modfile").val());
         clearInterval(loadInterval);
         showLoaderInfo(module);
      }
    }, 200);
    return false;
  });

  $("#load_cancel").click(function(){
    $("#loadercontainer").hide();
    $("#innercontainer").show();
    return false;
  });

  $("#add_playlist").click(function(){
    var song=$("#modfile").val();
    if (addToPlaylist(song)) refreshStoredPlaylist();
    return false;
  });

  $("#modfile").keypress(function(event) {
    if (event.keyCode==13) $btnLoadSelection.click();
  });

  $("#playlist_remove").click(function(){
    var opt=$("#playlist_box option:selected");
    if (opt.length) {
      var song=opt.val();
      opt.remove();
      refreshStoredPlaylist();
    }
    return false;
  });

  $("#playlist_clear").click(function(){
    $("#playlist_box").html("");
    refreshStoredPlaylist();
    return false;
  });

  $("#playlist_jumpto").click(function(){
    var opt=$("#playlist_box option:selected");
    if (opt.length) {
      if (module.playing) module.stop();
      module.setautostart(true);
      $("#loadercontainer").hide();
      $("#innercontainer").show();
      var loadInterval=setInterval(function(){
        if (!module.delayload) {
           window.currentModule=$("#playlist_box option:selected").val();
           window.playlistPosition=$("#playlist_box option").index($("#playlist_box option:selected"));
           window.playlistActive=true;
           module.load(musicPath+$("#playlist_box option:selected").val());
           clearInterval(loadInterval);
        }
      }, 200);
    }
    return false;
  });

  $("#playlist_box option").dblclick(function() {
    $("#playlist_jumpto").click();
  });

  $("#playlist_up").click(function(){
    var opt=$("#playlist_box option:selected");
    if (opt.length) {
      var p=$(opt).prev("option");
      if (p.length) {
        var v=$(p).val();
        var t=$(p).html();
        $(p).html($(opt).html());
        $(p).val($(opt).val());
        $(opt).html(t);
        $(opt).val(v);
        $("#playlist_box").val($(p).val()).change();
      }
      refreshStoredPlaylist();
    }
    return false;
  });

  $("#playlist_dn").click(function(){
    var opt=$("#playlist_box option:selected");
    if (opt.length) {
      var n=$(opt).next("option");
      if (n.length) {
        var v=$(n).val();
        var t=$(n).html();
        $(n).html($(opt).html());
        $(n).val($(opt).val());
        $(opt).html(t);
        $(opt).val(v);
        $("#playlist_box").val($(n).val()).change();
      }
      refreshStoredPlaylist();
    }
    return false;
  });

  $btnNextTrack.click(function(){
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
      playFromPlaylist(module, module.playing);
    }
    return false;
  });

  $btnPrevTrack.click(function(){
    var opt=$("#playlist_box option:selected");
    if (opt.length) {
      var p=$(opt).prev("option");
      if (p.length) {
        // load previous track
      } else {
        // jump to last
        p=$("#playlist_box option:last");
      }
      $("#playlist_box").val($(p).val()).change();
      playFromPlaylist(module, module.playing);
    }
    return false;
  });

  $("#loadfilter").on("input", updateSelectBox);

  $(document).keyup(function(ev){
    // keyboard shortcuts for main player screen
    if ($("#innercontainer").is(":visible")) {
      if (ev.keyCode==32) { // start/pause playback with space
        if (module.playing) {
          $btnPause.click();
        } else {
          $btnPlay.click();
        }
        event.preventDefault(); return false;
      }
      if (ev.keyCode==76) { // 'L' to open loading screen
        $btnShowLoadDialog.click();
        event.preventDefault(); return false;
      }
      if (ev.keyCode==37) { // left to jump to previous order
        $btnBack.click();
        event.preventDefault(); return false;
      }
      if (ev.keyCode==39) { // right to jump to next order
        $btnForward.click();
        event.preventDefault(); return false;
      }
    }

    // keyboard shortcuts for load/playlist screen
    if ($("#loadercontainer").is(":visible")) {
      if (ev.keyCode==27) {
        $("#load_cancel").click();
        event.preventDefault(); return false;
      }
    }
  });

  // all done, load the song library and default module
  var request = new XMLHttpRequest();
  request.open('GET', '/mods/library.json', true);
  request.responseType = 'json';
  request.onload = function() {
    window.musicLibrary = request.response;
    updateSelectBox(null);

    // get random song from library
    window.currentModule = getRandomTrack();

    const loadInterval = setInterval(function(){
      if (!module.delayload) {
         window.playlistActive = false;
         module.load(`${musicPath}${currentModule}`);
         clearInterval(loadInterval);
         showLoaderInfo(module);
      }
    }, 200);
  }
  request.send();
});

function getRandomTrack() {
  // get a full list of all tracks
  let allTracks = [];
  musicLibrary.forEach(composerData => {
    allTracks = allTracks.concat(composerData.songs.map(songData => `${composerData.composer}/${songData.file}`));
  });
  // return a random one
  return allTracks[Math.floor(Math.random()*allTracks.length)];
}
