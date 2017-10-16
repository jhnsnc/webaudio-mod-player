
// constants
var notelist=new Array('C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-');

var ft2volcmds=new Array('m', 'v', '^', '-', '+', 's', '~', 'p', '&lt;', '&gt;'); // 0x5 .. 0xe

function formatHex(num, len) { // TODO: maybe allow a toggle for uppercase/lowercase?
  let s = (num || 0).toString(16).padStart(len, '0');
  return s.substring(s.length-len).toUpperCase();
}


function formatUiString(str, len) {
  let result;
  // force length
  result = str.length>len ? str.substring(0, len-1) : str.padEnd(len, ' ');
  // escape characters
  result = result.replace(/&/g, '&amp;')
  result = result.replace(/</g, '&lt;')
  result = result.replace(/>/g, '&gt;')
  // done
  return result;
}


// originally "notef"
function renderNoteString(note, sample, volume, command, data, numChannels) {
  let noteString = null, sampleString = null, volumeString = null, commandString = null;

  // note
  if (note < 255) {
    noteString = note === 254 ? '===' : `<span class=\"note\">${notelist[note&0x0f]}${note>>4}</span>`;
  }
  // sample
  if (sample) {
    sampleString = `<span class=\"sample\">${formatHex(sample,2)}</span>`;
  }
  // volume
  if (volume != 255) {
    volumeString = '<span class=\"volume\">';
    if (volume<=0x40) {
      volumeString += formatHex(volume,2);
    } else {
      volumeString += ft2volcmds[(volume>>4)-5] + formatHex(volume,1);
    }
    volumeString += '</span>';
  }
  // command
  if (command!=0x2e) {
    commandString = `<span class=\"command\">${String.fromCharCode(command)}${formatHex(data,2)}</span>`;
  }

  let channelWidth;
  if (numChannels<=8) {
    channelWidth = 14; // max 112 chars
  } else if (numChannels<=10) {
    channelWidth = 11; // max 110 chars
  } else if (numChannels<=12) {
    channelWidth = 9; // max 108 chars
  } else if (numChannels<=16) {
    channelWidth = 7; // max 112 chars
  } else {
    channelWidth = 3; // max 96 chars
  }

  // construct string
  switch(channelWidth) {
    case 14: // all, w/ spaces separating
      return `${noteString||'...'} ${sampleString||'..'} ${volumeString||'..'} ${commandString||'...'}|`;
    case 11: // all, no spaces
      return `${noteString||'...'}${sampleString||'..'}${volumeString||'..'}${commandString||'...'}|`;
    case 9:  // cut either sample or volume
      return `${noteString||'...'}${sampleString||volumeString||'..'}${commandString||'...'}|`;
    case 7:  // note plus one of command/sample/volume
      return `${noteString||'...'}${commandString||((sampleString||volumeString||'..') + '.')}|`;
    case 3:  // only one note/command/sample/volume
    default:
      return noteString||commandString||` ${sampleString||volumeString||'..'}`;
  }
}


function renderPatternData(numPatterns, numChannels, getPatternData, context) {
  var pd = '';
  for(p=0; p<numPatterns; p++) {
    var pp, pdata;
    pd += `<div class=\"patterndata\" id=\"pattern${formatHex(p,2)}">`;
    // for(i=0; i<12; i++) pd += '\n';
    pdata = getPatternData.call(context, p); // TODO: this method should be able to iterate through pattern data without having to make a function call
    for(i=0; i<(pdata.length/(5*numChannels)); i++) {
      pp = i*5*numChannels;
      pd += `<div class=\"patternrow\" id=\"pattern${formatHex(p,2)}_row${formatHex(i,2)}\">${formatHex(i,2)}|`;
      for(c=0; c<numChannels; c++) {
        pd += renderNoteString(pdata[pp+c*5+0], pdata[pp+c*5+1], pdata[pp+c*5+2], pdata[pp+c*5+3], pdata[pp+c*5+4], numChannels);
      }
      pd += '</div>';
    }
    for(i=0; i<24; i++) pd += '\n';
    pd += '</div>';
  }
  return pd;
}


function renderChannelLevel(level) { // TODO: replace this with a pixel/canvas equivalent
  const n = Math.round(level*20);
  let result = '';
  let i;

  result = '<span style=\"color:#afa;\">';
  for(i=0;i<10;i++)
    result += (i<n) ? '&#x00BB;' : '&nbsp;';
  result += '</span><span style="color:#fea;">';
  for(;i<16;i++)
    result += (i<n) ? '&#x00BB;' : '&nbsp;';
  result += '</span><span style="color:#faa;">';
  for(;i<20;i++)
    result += (i<n) ? '&#x00BB;' : '&nbsp;';
  result += '</span>';

  return result;
}
