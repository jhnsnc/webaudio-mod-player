// basic mod info
module.title
module.signature
// playback controls/events
module.addEventListener('ready', ...)
module.addEventListener('play', ...)
module.addEventListener('stop', ...)
module.load()
module.stop()
module.play()
module.pause()
module.jump()
module.stopaudio()
// playback info (states)
module.delayload
module.loading
module.state
module.playing
module.paused
module.endofsong
// playback info (details)
module.speed
module.bpm
module.filter
module.position
module.songlen
module.row
module.currentpattlen()
module.currentsample()
module.currentpattern()
module.noteon()
module.chvu[]
// music content
module.channels
module.samplenames[]
module.patterns[]
module.patterndata[]
// settings
module.setrepeat()
module.setamigamodel('500' || '1200')
module.setseparation()
module.setautostart()

