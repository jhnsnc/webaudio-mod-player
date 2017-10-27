/*
  protracker module player for web audio api
  (c) 2012-2015 firehawk/tda  (firehawk@haxor.fi)

  reference:
  - http://www.aes.id.au/modformat.html
  - https://www.ocf.berkeley.edu/~eek/index.html/tiny_examples/ptmod/ap12.html
  - https://wiki.multimedia.cx/index.php/Protracker_Module

  todo:
  - pattern looping is broken (see mod.black_queen)
  - properly test EEx delay pattern

*/

function Emitter() {
  var eventTarget = document.createDocumentFragment();

  Emitter.methods.forEach(function(method) {
    this[method] = eventTarget[method].bind(eventTarget);
  }, this);
}
Emitter.methods = ['addEventListener', 'dispatchEvent', 'removeEventListener'];


// constructor for protracker player object
function Protracker() {
  Emitter.call(this);

  this.init();
  this.reset();

  this.playing = false;
  this.paused = false;
  this.repeat = false;

  this.filter = false;

  this.mixval = 4.0;

  this.syncqueue = [];

  this.samplerate = 44100;

  // paula period values
  this.baseperiodtable = new Float32Array([
    856,808,762,720,678,640,604,570,538,508,480,453,
    428,404,381,360,339,320,302,285,269,254,240,226,
    214,202,190,180,170,160,151,143,135,127,120,113
  ]);

  // finetune multipliers
  this.finetunetable = new Float32Array(16).map((x,i)=>Math.pow(2,(i-8)/12/8));

  // calc tables for vibrato waveforms
  this.vibratotable = [
    new Float32Array(64).map((x,i)=>127*Math.sin(2*Math.PI*i/64)),
    new Float32Array(64).map((x,i)=>127-4*i),
    new Float32Array(64).map((x,i)=>i<32?127:-127),
    new Float32Array(64).map((x,i)=>(1-2*Math.random())*127),
  ];

  // effect jumptables
  this.effects_t0 = [
    this.effect_t0_0, this.effect_t0_1, this.effect_t0_2, this.effect_t0_3, this.effect_t0_4, this.effect_t0_5, this.effect_t0_6, this.effect_t0_7,
    this.effect_t0_8, this.effect_t0_9, this.effect_t0_a, this.effect_t0_b, this.effect_t0_c, this.effect_t0_d, this.effect_t0_e, this.effect_t0_f,
  ];
  this.effects_t0_e = [
    this.effect_t0_e0, this.effect_t0_e1, this.effect_t0_e2, this.effect_t0_e3, this.effect_t0_e4, this.effect_t0_e5, this.effect_t0_e6, this.effect_t0_e7,
    this.effect_t0_e8, this.effect_t0_e9, this.effect_t0_ea, this.effect_t0_eb, this.effect_t0_ec, this.effect_t0_ed, this.effect_t0_ee, this.effect_t0_ef,
  ];
  this.effects_t1 = [
    this.effect_t1_0, this.effect_t1_1, this.effect_t1_2, this.effect_t1_3, this.effect_t1_4, this.effect_t1_5, this.effect_t1_6, this.effect_t1_7,
    this.effect_t1_8, this.effect_t1_9, this.effect_t1_a, this.effect_t1_b, this.effect_t1_c, this.effect_t1_d, this.effect_t1_e, this.effect_t1_f,
  ];
  this.effects_t1_e = [
    this.effect_t1_e0, this.effect_t1_e1, this.effect_t1_e2, this.effect_t1_e3, this.effect_t1_e4, this.effect_t1_e5, this.effect_t1_e6, this.effect_t1_e7,
    this.effect_t1_e8, this.effect_t1_e9, this.effect_t1_ea, this.effect_t1_eb, this.effect_t1_ec, this.effect_t1_ed, this.effect_t1_ee, this.effect_t1_ef,
  ];
}



// clear song data
Protracker.prototype.init = function() {
  var i;

  this.title = '';
  this.signature = '';

  this.songlen = 1;
  this.repeatpos = 0;
  this.patternSequence = new ArrayBuffer(128);
  for(i=0; i<128; i++) this.patternSequence[i] = 0;

  this.channels = 4;

  this.samples = 31;
  this.sample = [];
  for(i=0; i<this.samples; i++) {
    this.sample.push({
      name: '',
      length: 0,
      finetune: 0,
      volume: 64,
      loopstart: 0,
      looplength: 0,
      data: 0,
    });
  }

  this.patterns = 0;
  this.patternDataRaw = [];
  this.patternDataUnpacked = [];

  this.looprow = 0;
  this.loopstart = 0;
  this.loopcount = 0;

  this.patterndelay = 0;
  this.patternwait = 0;
}


// reset all player variables
Protracker.prototype.reset = function() {
  this.syncqueue = [];

  this.tick = 0;
  this.position = 0;
  this.row = 0;
  this.offset = 0;
  this.flags = 0;

  this.speed = 6;
  this.bpm = 125;
  this.breakrow = 0;
  this.patternjump = 0;
  this.patterndelay = 0;
  this.patternwait = 0;
  this.endofsong = false;

  this.channel = [];
  for(var i=0; i<this.channels; i++) {
    this.channel.push({
      sample: 0,
      period: 214,
      voiceperiod: 214,
      note: 24,
      volume: 64,
      command: 0,
      data: 0,
      samplepos: 0,
      samplespeed: 0,
      flags: 0,
      noteon: 0,
      slidespeed: 0,
      slideto: 214,
      slidetospeed: 0,
      arpeggio: 0,

      semitone: 12,
      vibratospeed: 0,
      vibratodepth: 0,
      vibratopos: 0,
      vibratowave: 0,
    });
  }
}



// parse the module from local buffer
// buffier should be type Uint8Array
Protracker.prototype.parse = function(buffer) {
  var i,j,c;

  // signature and channels init
  this.signature = stringFromBuffer(buffer, 1080, 4);
  switch (this.signature) {
    case 'M.K.':
    case 'M!K!':
    case '4CHN':
    case 'FLT4':
      break;
    case '6CHN':
      this.channels=6;
      break;
    case '8CHN':
    case 'FLT8':
      this.channels=8;
      break;
    case '28CH':
      this.channels=28;
      break;
    default:
      return false; // invalid signature // TODO: throw error message
  }
  this.chvu = new Array(this.channels).fill(0.0);

  // title
  this.title = stringFromBuffer(buffer, 0, 20, {
    stopAt: b=>!b
  });

  // samples
  var sampleOffset;
  for(i=0; i<this.samples; i++) {
    sampleOffset = 20 +i*30;

    this.sample[i].name = stringFromBuffer(buffer, sampleOffset, 22, {
      stopAt: b=>!b,
      interpretByte: b=>b>0x1f&&b<0x7f ? String.fromCharCode(b) : ' ',
    });

    this.sample[i].length = 2*numFromBuffer(buffer, sampleOffset+22, 2);

    this.sample[i].finetune = buffer[sampleOffset+24];
    if (this.sample[i].finetune > 7)
      this.sample[i].finetune = this.sample[i].finetune - 16;

    this.sample[i].volume = buffer[sampleOffset+25];

    this.sample[i].loopstart = 2*numFromBuffer(buffer, sampleOffset+26, 2);
    this.sample[i].looplength = 2*numFromBuffer(buffer, sampleOffset+28, 2);
    if (this.sample[i].looplength == 2)
      this.sample[i].looplength = 0;
    if (this.sample[i].loopstart > this.sample[i].length) {
      this.sample[i].loopstart = 0;
      this.sample[i].looplength = 0;
    }
  }

  // song sequence (pattern order), length, repeat/loop point
  this.songlen = buffer[950];
  this.repeatpos = (buffer[951] != 127) ? buffer[951] : 0;
  for(i=0; i<128; i++) {
    this.patternSequence[i] = buffer[952+i];
    // num patterns = the latest referenced pattern in the song sequence
    this.patterns = Math.max(this.patterns, this.patternSequence[i] + 1);
  }

  // pattern data (individual notes for each pattern)
  var patlen = 4*64*this.channels; // 4 bytes per note, 64 beat per pattern, one note per channel per beat
  this.patternDataRaw = [];
  this.patternDataUnpacked = [];
  for(i=0; i<this.patterns; i++) {
    // copy pattern data from raw buffer
    this.patternDataRaw[i] = copyFromBuffer(buffer, new Uint8Array(patlen), 1084+i*patlen, patlen);

    // unpack pattern data
    this.patternDataUnpacked[i] = new Uint8Array(this.channels*64*5);
    for(j=0; j<64; j++) {
      for(c=0; c<this.channels; c++) {
        var pp = j*4*this.channels+c*4;
        var ppu = j*5*this.channels+c*5;

        // identify note period (lookup value split 4 bits on byte 1, all of byte 2)
        var n = (this.patternDataRaw[i][pp]&0x0f)<<8 | this.patternDataRaw[i][pp+1];
        if (n) {
          var ptlu = 0;
          for(var np=0; np<this.baseperiodtable.length; np++)
            if (n==this.baseperiodtable[np])
              ptlu = np;
          n = ptlu;

          n = (n%12)|(Math.floor(n/12)+2)<<4; // convert to (octave/note), highest val 0b01001011
        }
          // note period
        this.patternDataUnpacked[i][ppu+0] = n || 255;
          // sample number (split across bytes 1/3)
        this.patternDataUnpacked[i][ppu+1] = this.patternDataRaw[i][pp+0]&0xf0 | this.patternDataRaw[i][pp+2]>>4;
          // TODO: ??? what is this value?
        this.patternDataUnpacked[i][ppu+2] = 255;
          // effect command (4 bits)
        this.patternDataUnpacked[i][ppu+3] = this.patternDataRaw[i][pp+2]&0x0f;
          // effect params (8 bits)
        this.patternDataUnpacked[i][ppu+4] = this.patternDataRaw[i][pp+3];
      }
    }
  }

  // sample data (actual sample content)
  sampleOffset = 1084+this.patterns*patlen;
  this.sample.forEach(sample=>{
    sample.data = copyFromBuffer(
      buffer, new Float32Array(sample.length),
      sampleOffset, sample.length,
      q=>q<128 ? q/128.0 : ((q-128.0)/128.0)-1.0 // [-1.0, 1.0]
    );
    sampleOffset += sample.length;
  })

  // look ahead at very first row to see if filter gets enabled
  this.filter = false;
  var firstPattern = this.patternDataUnpacked[this.patternSequence[0]];
  for(var ch=0; ch<this.channels; ch++) {
    var cmd = firstPattern[ch*4+3];
    var data = firstPattern[ch*4+4];
    if (cmd == 0xe && ((data&0xf0) == 0x00)) {
      this.filter = !(data&0x01);
    }
  }

  // set lowpass cutoff
  if (this.context) {
    this.lowpassNode.frequency.value = this.filter ? 3275 : 28867;
  }

  // clear channel output levels
  this.chvu = new Float32Array(this.channels).map(()=>0.0);

  return true; // TODO: change this to async
}



// advance player
Protracker.prototype.advance = function(mod) {
  var spd=(((mod.samplerate*60)/mod.bpm)/4)/6;

  // advance player
  if (mod.offset>spd) { mod.tick++; mod.offset=0; mod.flags|=1; }
  if (mod.tick>=mod.speed) {

    if (mod.patterndelay) { // delay pattern
      if (mod.tick < ((mod.patternwait+1)*mod.speed)) {
        mod.patternwait++;
      } else {
        mod.row++; mod.tick=0; mod.flags|=2; mod.patterndelay=0;
      }
    }
    else {
      if (mod.flags&(16+32+64)) {
        if (mod.flags&64) { // loop pattern?
          mod.row=mod.looprow;
          mod.flags&=0xa1;
          mod.flags|=2;
        }
        else {
          if (mod.flags&16) { // pattern jump/break?
            mod.position=mod.patternjump;
            mod.row=mod.breakrow;
            mod.patternjump=0;
            mod.breakrow=0;
            mod.flags&=0xe1;
            mod.flags|=2;
          }
        }
        mod.tick=0;
      } else {
        mod.row++; mod.tick=0; mod.flags|=2;
      }
    }
  }
  if (mod.row>=64) { mod.position++; mod.row=0; mod.flags|=4; }
  if (mod.position>=mod.songlen) {
    if (mod.repeat) {
      mod.position=0;
    } else {
      this.endofsong=true;
      //mod.stop();
    }
    return;
  }
}



// mix an audio buffer with data
Protracker.prototype.mix = function(mod, bufs, buflen) {
  var f;
  var p, pp, n, nn;

  var outp=new Float32Array(2);
  for(var s=0;s<buflen;s++)
  {
    outp[0]=0.0;
    outp[1]=0.0;

    if (!mod.paused && !mod.endofsong && mod.playing)
    {
      mod.advance(mod);

      var och=0;
      for(var ch=0;ch<mod.channels;ch++)
      {

        // calculate playback position
        p=mod.patternSequence[mod.position];
        pp=mod.row*4*mod.channels + ch*4;
        if (mod.flags&2) { // new row
          mod.channel[ch].command=mod.patternDataRaw[p][pp+2]&0x0f;
          mod.channel[ch].data=mod.patternDataRaw[p][pp+3];

          if (!(mod.channel[ch].command==0x0e && (mod.channel[ch].data&0xf0)==0xd0)) {
            n=(mod.patternDataRaw[p][pp]&0x0f)<<8 | mod.patternDataRaw[p][pp+1];
            if (n) {
              // noteon, except if command=3 (porta to note)
              if ((mod.channel[ch].command != 0x03) && (mod.channel[ch].command != 0x05)) {
                mod.channel[ch].period=n;
                mod.channel[ch].samplepos=0;
                if (mod.channel[ch].vibratowave>3) mod.channel[ch].vibratopos=0;
                mod.channel[ch].flags|=3; // recalc speed
                mod.channel[ch].noteon=1;
              }
              // in either case, set the slide to note target
              mod.channel[ch].slideto=n;
            }
            nn=mod.patternDataRaw[p][pp+0]&0xf0 | mod.patternDataRaw[p][pp+2]>>4;
            if (nn) {
              mod.channel[ch].sample=nn-1;
              mod.channel[ch].volume=mod.sample[nn-1].volume;
              if (!n && (mod.channel[ch].samplepos > mod.sample[nn-1].length)) mod.channel[ch].samplepos=0;
            }
          }
        }
        mod.channel[ch].voiceperiod=mod.channel[ch].period;

        // kill empty samples
        if (!mod.sample[mod.channel[ch].sample].length) mod.channel[ch].noteon=0;

        // effects
        if (mod.flags&1) {
          if (!mod.tick) {
            // process only on tick 0
            mod.effects_t0[mod.channel[ch].command](mod, ch);
          } else {
            mod.effects_t1[mod.channel[ch].command](mod, ch);
          }
        }

        // recalc note number from period
        if (mod.channel[ch].flags&2) {
          for(var np=0; np<mod.baseperiodtable.length; np++)
            if (mod.baseperiodtable[np]>=mod.channel[ch].period) mod.channel[ch].note=np;
          mod.channel[ch].semitone=7;
          if (mod.channel[ch].period>=120)
            mod.channel[ch].semitone=mod.baseperiodtable[mod.channel[ch].note]-mod.baseperiodtable[mod.channel[ch].note+1];
        }

        // recalc sample speed and apply finetune
        if ((mod.channel[ch].flags&1 || mod.flags&2) && mod.channel[ch].voiceperiod)
          mod.channel[ch].samplespeed=
            7093789.2/(mod.channel[ch].voiceperiod*2) * mod.finetunetable[mod.sample[mod.channel[ch].sample].finetune+8] / mod.samplerate;

        // advance vibrato on each new tick
        if (mod.flags&1) {
          mod.channel[ch].vibratopos+=mod.channel[ch].vibratospeed;
          mod.channel[ch].vibratopos&=0x3f;
        }

        // mix channel to output
        och=och^(ch&1);
        f=0.0;
        if (mod.channel[ch].noteon) {
          if (mod.sample[mod.channel[ch].sample].length > mod.channel[ch].samplepos)
            f=(mod.sample[mod.channel[ch].sample].data[Math.floor(mod.channel[ch].samplepos)]*mod.channel[ch].volume)/64.0;
          outp[och]+=f;
          mod.channel[ch].samplepos+=mod.channel[ch].samplespeed;
        }
        mod.chvu[ch]=Math.max(mod.chvu[ch], Math.abs(f));

        // loop or end samples
        if (mod.channel[ch].noteon) {
          if (mod.sample[mod.channel[ch].sample].loopstart || mod.sample[mod.channel[ch].sample].looplength) {
            if (mod.channel[ch].samplepos >= (mod.sample[mod.channel[ch].sample].loopstart+mod.sample[mod.channel[ch].sample].looplength)) {
              mod.channel[ch].samplepos-=mod.sample[mod.channel[ch].sample].looplength;
            }
          } else {
            if (mod.channel[ch].samplepos >= mod.sample[mod.channel[ch].sample].length) {
              mod.channel[ch].noteon=0;
            }
          }
        }

        // clear channel flags
        mod.channel[ch].flags=0;
      }
      mod.offset++;
      mod.flags&=0x70;
    }

    // done - store to output buffer
    bufs[0][s]=outp[0];
    bufs[1][s]=outp[1];
  }
}



//
// tick 0 effect functions
//
Protracker.prototype.effect_t0_0=function(mod, ch) { // 0 arpeggio
  mod.channel[ch].arpeggio=mod.channel[ch].data;
}
Protracker.prototype.effect_t0_1=function(mod, ch) { // 1 slide up
  if (mod.channel[ch].data) mod.channel[ch].slidespeed=mod.channel[ch].data;
}
Protracker.prototype.effect_t0_2=function(mod, ch) { // 2 slide down
  if (mod.channel[ch].data) mod.channel[ch].slidespeed=mod.channel[ch].data;
}
Protracker.prototype.effect_t0_3=function(mod, ch) { // 3 slide to note
  if (mod.channel[ch].data) mod.channel[ch].slidetospeed=mod.channel[ch].data;
}
Protracker.prototype.effect_t0_4=function(mod, ch) { // 4 vibrato
  if (mod.channel[ch].data&0x0f && mod.channel[ch].data&0xf0) {
    mod.channel[ch].vibratodepth=(mod.channel[ch].data&0x0f);
    mod.channel[ch].vibratospeed=(mod.channel[ch].data&0xf0)>>4;
  }
  mod.effects_t1[4](mod, ch);
}
Protracker.prototype.effect_t0_5=function(mod, ch) { // 5
}
Protracker.prototype.effect_t0_6=function(mod, ch) { // 6
}
Protracker.prototype.effect_t0_7=function(mod, ch) { // 7
}
Protracker.prototype.effect_t0_8=function(mod, ch) { // 8 unused, used for syncing
  mod.syncqueue.unshift(mod.channel[ch].data&0x0f);
}
Protracker.prototype.effect_t0_9=function(mod, ch) { // 9 set sample offset
  mod.channel[ch].samplepos=mod.channel[ch].data*256;
}
Protracker.prototype.effect_t0_a=function(mod, ch) { // a
}
Protracker.prototype.effect_t0_b=function(mod, ch) { // b pattern jump
  mod.breakrow=0;
  mod.patternjump=mod.channel[ch].data;
  mod.flags|=16;
}
Protracker.prototype.effect_t0_c=function(mod, ch) { // c set volume
  mod.channel[ch].volume=mod.channel[ch].data;
}
Protracker.prototype.effect_t0_d=function(mod, ch) { // d pattern break
  mod.breakrow=((mod.channel[ch].data&0xf0)>>4)*10 + (mod.channel[ch].data&0x0f);
  if (!(mod.flags&16)) mod.patternjump=mod.position+1;
  mod.flags|=16;
}
Protracker.prototype.effect_t0_e=function(mod, ch) { // e
  var i=(mod.channel[ch].data&0xf0)>>4;
  mod.effects_t0_e[i](mod, ch);
}
Protracker.prototype.effect_t0_f=function(mod, ch) { // f set speed
  if (mod.channel[ch].data > 32) {
    mod.bpm=mod.channel[ch].data;
  } else {
    if (mod.channel[ch].data) mod.speed=mod.channel[ch].data;
  }
}



//
// tick 0 effect e functions
//
Protracker.prototype.effect_t0_e0=function(mod, ch) { // e0 filter on/off
  if (mod.channels > 4) return; // use only for 4ch amiga tunes
  if (mod.channel[ch].data&0x01) {
    mod.filter=false;
  } else {
    mod.filter=true;
  }
}
Protracker.prototype.effect_t0_e1=function(mod, ch) { // e1 fine slide up
  mod.channel[ch].period-=mod.channel[ch].data&0x0f;
  if (mod.channel[ch].period < 113) mod.channel[ch].period=113;
}
Protracker.prototype.effect_t0_e2=function(mod, ch) { // e2 fine slide down
  mod.channel[ch].period+=mod.channel[ch].data&0x0f;
  if (mod.channel[ch].period > 856) mod.channel[ch].period=856;
  mod.channel[ch].flags|=1;
}
Protracker.prototype.effect_t0_e3=function(mod, ch) { // e3 set glissando
}
Protracker.prototype.effect_t0_e4=function(mod, ch) { // e4 set vibrato waveform
  mod.channel[ch].vibratowave=mod.channel[ch].data&0x07;
}
Protracker.prototype.effect_t0_e5=function(mod, ch) { // e5 set finetune
}
Protracker.prototype.effect_t0_e6=function(mod, ch) { // e6 loop pattern
  if (mod.channel[ch].data&0x0f) {
    if (mod.loopcount) {
      mod.loopcount--;
    } else {
      mod.loopcount=mod.channel[ch].data&0x0f;
    }
    if (mod.loopcount) mod.flags|=64;
  } else {
    mod.looprow=mod.row;
  }
}
Protracker.prototype.effect_t0_e7=function(mod, ch) { // e7
}
Protracker.prototype.effect_t0_e8=function(mod, ch) { // e8, use for syncing
  mod.syncqueue.unshift(mod.channel[ch].data&0x0f);
}
Protracker.prototype.effect_t0_e9=function(mod, ch) { // e9
}
Protracker.prototype.effect_t0_ea=function(mod, ch) { // ea fine volslide up
  mod.channel[ch].volume+=mod.channel[ch].data&0x0f;
  if (mod.channel[ch].volume > 64) mod.channel[ch].volume=64;
}
Protracker.prototype.effect_t0_eb=function(mod, ch) { // eb fine volslide down
  mod.channel[ch].volume-=mod.channel[ch].data&0x0f;
  if (mod.channel[ch].volume < 0) mod.channel[ch].volume=0;
}
Protracker.prototype.effect_t0_ec=function(mod, ch) { // ec
}
Protracker.prototype.effect_t0_ed=function(mod, ch) { // ed delay sample
  if (mod.tick==(mod.channel[ch].data&0x0f)) {
    // start note
    var p=mod.patternSequence[mod.position];
    var pp=mod.row*4*mod.channels + ch*4;
    n=(mod.patternDataRaw[p][pp]&0x0f)<<8 | mod.patternDataRaw[p][pp+1];
    if (n) {
      mod.channel[ch].period=n;
      mod.channel[ch].voiceperiod=mod.channel[ch].period;
      mod.channel[ch].samplepos=0;
      if (mod.channel[ch].vibratowave>3) mod.channel[ch].vibratopos=0;
      mod.channel[ch].flags|=3; // recalc speed
      mod.channel[ch].noteon=1;
    }
    n=mod.patternDataRaw[p][pp+0]&0xf0 | mod.patternDataRaw[p][pp+2]>>4;
    if (n) {
      mod.channel[ch].sample=n-1;
      mod.channel[ch].volume=mod.sample[n-1].volume;
    }
  }
}
Protracker.prototype.effect_t0_ee=function(mod, ch) { // ee delay pattern
  mod.patterndelay=mod.channel[ch].data&0x0f;
  mod.patternwait=0;
}
Protracker.prototype.effect_t0_ef=function(mod, ch) { // ef
}



//
// tick 1+ effect functions
//
Protracker.prototype.effect_t1_0=function(mod, ch) { // 0 arpeggio
  if (mod.channel[ch].data) {
    var apn=mod.channel[ch].note;
    if ((mod.tick%3)==1) apn+=mod.channel[ch].arpeggio>>4;
    if ((mod.tick%3)==2) apn+=mod.channel[ch].arpeggio&0x0f;
    if (apn>=0 && apn <= mod.baseperiodtable.length)
      mod.channel[ch].voiceperiod = mod.baseperiodtable[apn];
    mod.channel[ch].flags|=1;
  }
}
Protracker.prototype.effect_t1_1=function(mod, ch) { // 1 slide up
  mod.channel[ch].period-=mod.channel[ch].slidespeed;
  if (mod.channel[ch].period<113) mod.channel[ch].period=113;
  mod.channel[ch].flags|=3; // recalc speed
}
Protracker.prototype.effect_t1_2=function(mod, ch) { // 2 slide down
  mod.channel[ch].period+=mod.channel[ch].slidespeed;
  if (mod.channel[ch].period>856) mod.channel[ch].period=856;
  mod.channel[ch].flags|=3; // recalc speed
}
Protracker.prototype.effect_t1_3=function(mod, ch) { // 3 slide to note
  if (mod.channel[ch].period < mod.channel[ch].slideto) {
    mod.channel[ch].period+=mod.channel[ch].slidetospeed;
    if (mod.channel[ch].period > mod.channel[ch].slideto)
      mod.channel[ch].period=mod.channel[ch].slideto;
  }
  if (mod.channel[ch].period > mod.channel[ch].slideto) {
    mod.channel[ch].period-=mod.channel[ch].slidetospeed;
    if (mod.channel[ch].period<mod.channel[ch].slideto)
      mod.channel[ch].period=mod.channel[ch].slideto;
  }
  mod.channel[ch].flags|=3; // recalc speed
}
Protracker.prototype.effect_t1_4=function(mod, ch) { // 4 vibrato
  var waveform=mod.vibratotable[mod.channel[ch].vibratowave&3][mod.channel[ch].vibratopos]/63.0; //127.0;

  // two different implementations for vibrato
//  var a=(mod.channel[ch].vibratodepth/32)*mod.channel[ch].semitone*waveform; // non-linear vibrato +/- semitone
  var a=mod.channel[ch].vibratodepth*waveform; // linear vibrato, depth has more effect high notes

  mod.channel[ch].voiceperiod+=a;
  mod.channel[ch].flags|=1;
}
Protracker.prototype.effect_t1_5=function(mod, ch) { // 5 volslide + slide to note
  mod.effect_t1_3(mod, ch); // slide to note
  mod.effect_t1_a(mod, ch); // volslide
}
Protracker.prototype.effect_t1_6=function(mod, ch) { // 6 volslide + vibrato
  mod.effect_t1_4(mod, ch); // vibrato
  mod.effect_t1_a(mod, ch); // volslide
}
Protracker.prototype.effect_t1_7=function(mod, ch) { // 7
}
Protracker.prototype.effect_t1_8=function(mod, ch) { // 8 unused
}
Protracker.prototype.effect_t1_9=function(mod, ch) { // 9 set sample offset
}
Protracker.prototype.effect_t1_a=function(mod, ch) { // a volume slide
  if (!(mod.channel[ch].data&0x0f)) {
    // y is zero, slide up
    mod.channel[ch].volume+=(mod.channel[ch].data>>4);
    if (mod.channel[ch].volume>64) mod.channel[ch].volume=64;
  }
  if (!(mod.channel[ch].data&0xf0)) {
    // x is zero, slide down
    mod.channel[ch].volume-=(mod.channel[ch].data&0x0f);
    if (mod.channel[ch].volume<0) mod.channel[ch].volume=0;
  }
}
Protracker.prototype.effect_t1_b=function(mod, ch) { // b pattern jump
}
Protracker.prototype.effect_t1_c=function(mod, ch) { // c set volume
}
Protracker.prototype.effect_t1_d=function(mod, ch) { // d pattern break
}
Protracker.prototype.effect_t1_e=function(mod, ch) { // e
  var i=(mod.channel[ch].data&0xf0)>>4;
  mod.effects_t1_e[i](mod, ch);
}
Protracker.prototype.effect_t1_f=function(mod, ch) { // f
}



//
// tick 1+ effect e functions
//
Protracker.prototype.effect_t1_e0=function(mod, ch) { // e0
}
Protracker.prototype.effect_t1_e1=function(mod, ch) { // e1
}
Protracker.prototype.effect_t1_e2=function(mod, ch) { // e2
}
Protracker.prototype.effect_t1_e3=function(mod, ch) { // e3
}
Protracker.prototype.effect_t1_e4=function(mod, ch) { // e4
}
Protracker.prototype.effect_t1_e5=function(mod, ch) { // e5
}
Protracker.prototype.effect_t1_e6=function(mod, ch) { // e6
}
Protracker.prototype.effect_t1_e7=function(mod, ch) { // e7
}
Protracker.prototype.effect_t1_e8=function(mod, ch) { // e8
}
Protracker.prototype.effect_t1_e9=function(mod, ch) { // e9 retrig sample
  if (mod.tick%(mod.channel[ch].data&0x0f)==0)
    mod.channel[ch].samplepos=0;
}
Protracker.prototype.effect_t1_ea=function(mod, ch) { // ea
}
Protracker.prototype.effect_t1_eb=function(mod, ch) { // eb
}
Protracker.prototype.effect_t1_ec=function(mod, ch) { // ec cut sample
  if (mod.tick==(mod.channel[ch].data&0x0f))
    mod.channel[ch].volume=0;
}
Protracker.prototype.effect_t1_ed=function(mod, ch) { // ed delay sample
  mod.effect_t0_ed(mod, ch);
}
Protracker.prototype.effect_t1_ee=function(mod, ch) { // ee
}
Protracker.prototype.effect_t1_ef=function(mod, ch) { // ef
}
