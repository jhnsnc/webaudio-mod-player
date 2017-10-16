// TODO: turn this into a proper module/closure

var $btnPrevTrack;
var $btnNextTrack;

function setupPlaylistUi() {
  // cache DOM elements
  $btnPrevTrack = $('#prev_track');
  $btnNextTrack = $('#next_track');

  // do setup
  $btnShowLoadDialog.click(function(){
    $("#loadercontainer").show();
    $mainContainer.hide();
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

  $("#loadfilter").on("input", updateSelectBox);

  $btnLoadSelection.click(function(){
    if (module.playing) {
      module.stop();
      module.setautostart(true);
    } else {
      module.setautostart(false);
    }
    $("#loadercontainer").hide();
    $mainContainer.show();
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
    $mainContainer.show();
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
      $mainContainer.show();
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
}

function updateSelectBox(e) {
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

