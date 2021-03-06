var voices = new Array();
var audioContext = null;
var note = 72;
var volNode;
var filter = null;
var sounds1 = new Array();
sounds1.oscIndex = -999;
sounds1.volIndex= -999;
sounds1.isPlaying = false;
sounds1.noiseIndex = -999;
sounds1.ringModIndex = -999;
var sounds2 = new Array();
sounds2.oscIndex = -999;
sounds2.volIndex= -999;
sounds2.isPlaying = false;
sounds2.noiseIndex = -999;
sounds2.ringModIndex = -999;
var sounds3 = new Array();
sounds3.oscIndex = -999;
sounds3.volIndex= -999;
sounds3.isPlaying = false;
sounds3.noiseIndex = -999;
sounds3.ringModIndex = -999;

// This is the "initial patch" of the ADSR settings.  YMMV.
var currentEnvA = 7;
var currentEnvD = 15;
var currentEnvS = 50;
var currentEnvR = 20;

// end initial patch
var currentOctave = 3;

// the onscreen keyboard "ASCII-key-to-MIDI-note" conversion array
var keys = new Array( 256 );
keys[65] = 60; // = C4 ("middle C")
keys[87] = 61;
keys[83] = 62;
keys[69] = 63;
keys[68] = 64;
keys[70] = 65; // = F4
keys[84] = 66;
keys[71] = 67;
keys[89] = 68;
keys[72] = 69;
keys[85] = 70;
keys[74] = 71;
keys[75] = 72; // = C5
keys[79] = 73;
keys[76] = 74;
keys[80] = 75;
keys[186] = 76;
keys[222] = 77; // = F5
keys[221] = 78;
keys[13] = 79;
keys[220] = 80;


function impulseResponse( duration, decay ) {
    var sampleRate = audioContext.sampleRate;
    var length = sampleRate * duration;
    var impulse = audioContext.createBuffer(2, length, sampleRate);
    var impulseL = impulse.getChannelData(0);
    var impulseR = impulse.getChannelData(1);

    if (!decay)
        decay = 2.0;
    for (var i = 0; i < length; i++){
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
}

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function noteOn( note, velocity ) {
	if (voices[note] == null) {
		voices[note] = new Voice(note, velocity);
		var e = document.getElementById( "k" + note );
		if (e)
			e.classList.add("pressed");
	}
}

function noteOff( note ) {
	if (voices[note] != null) {
		// Shut off the note playing and clear it 
		voices[note].noteOff();
		voices[note] = null;
		var e = document.getElementById( "k" + note );
		if (e)
			e.classList.remove("pressed");
	}

}

// 'value' is normalized to 0..1.
function controller( number, value ) {
	switch (number) {
		case 1:
			// do something with CC#1
			break;
		case 2:
			// do something with CC#2
			break;
	}
}

// 'value' is normalized to [-1,1]
function pitchWheel( value ) {
	var i;
	
	for (i in voices) {
		if (voices[i] && voices[i].osc)
			voices[i].osc.detune.value = value * 500;	// value in cents - detune major fifth.
	}
}

function Voice( note, velocity ) {
	this.originalFrequency = frequencyFromNoteNumber( note );

	// create oscillator
	this.osc = audioContext.createOscillator();
	this.osc.frequency.setValueAtTime(this.originalFrequency, 0);

	// create the volume envelope
	this.envelope = audioContext.createGainNode();
	this.osc.connect( this.envelope );
	this.envelope.connect( effectChain );

	// set up the volume ADSR envelope
	var now = audioContext.currentTime;
	var envAttackEnd = now + (currentEnvA/10.0);

	this.envelope.gain.value = 0.0;
	this.envelope.gain.setValueAtTime( 0.0, now );
	this.envelope.gain.linearRampToValueAtTime( 1.0, envAttackEnd );
	this.envelope.gain.setTargetValueAtTime( (currentEnvS/100.0), envAttackEnd, (currentEnvD/100.0)+0.001 );

	this.osc.noteOn(0);
}

Voice.prototype.noteOff = function() {
	var now =  audioContext.currentTime;
	var release = now + (currentEnvR/10.0);	

	this.envelope.gain.cancelScheduledValues(now);
	this.envelope.gain.setValueAtTime( this.envelope.gain.value, now );  // this is necessary because of the linear ramp
	this.envelope.gain.setTargetValueAtTime(0.0, now, (currentEnvR/100));

	this.osc.noteOff( release );
}

function keyDown( ev ) {
	note = keys[ev.keyCode];
	if (note) {
		noteOn( note + 12*(3-currentOctave), 0.75 );
		displayFreq();
		updateNote(sounds1);
		updateNote(sounds2);
		updateNote(sounds3);
		stopAll();
		playAll();
	}
	var e = document.getElementById( "k" + note );
	if (e)
		e.classList.add("pressed");
	return false;
}

function keyUp( ev ) {
	note = keys[ev.keyCode];
	if (note)
		noteOff( note + 12*(3-currentOctave) );
	var e = document.getElementById( "k" + note );
	if (e)
		e.classList.remove("pressed");
	return false;
}

function pointerDown( ev ) {
	note = parseInt( ev.target.id.substring( 1 ) );
	if (note != NaN) {
		noteOn( note + 12*(3-currentOctave), 0.75 );
		displayFreq();
		updateNote(sounds1);
		updateNote(sounds2);
		updateNote(sounds3);
		stopAll();
		playAll();
	}
	ev.target.classList.add("pressed");
	return false;
}

function pointerUp( ev ) {
	note = parseInt( ev.target.id.substring( 1 ) );
	if (note != NaN)
		noteOff( note + 12*(3-currentOctave) );
	ev.target.classList.remove("pressed");
	return false;
}

function initAudio() {
	try {
    	audioContext = new webkitAudioContext();
  	}
  	catch(e) {
    	alert('Web Audio API is not supported in this browser');
  	}

	window.addEventListener('keydown', keyDown, false);
	window.addEventListener('keyup', keyUp, false);

	effectChain = audioContext.createGainNode();
    volNode = audioContext.createGainNode();
    volNode.gain.value = 0.25;    
    effectChain.connect( volNode );

    volNode.connect( audioContext.destination );

    // Synthesize a reverb impulse response (could use XHR to download one).
//	revNode.buffer = impulseResponse( 5.0, 2.0 );
	synthBox = document.getElementById("synthbox");

	var keys = document.querySelectorAll( ".key" );
	for (var i=0; i<keys.length; i++) {
		keys[i].addEventListener('pointerdown', pointerDown);
		keys[i].addEventListener('pointerup', pointerUp);
	}
	var kbOct = document.getElementById("kbd_oct");
	kbOct.onchange = function() { currentOctave = document.getElementById("kbd_oct").selectedIndex; }
}

function oscillator(arr, type) {
	if (arr.noiseIndex != -999) {
		arr.splice(arr.noiseIndex, 1);
		arr.noiseIndex = -999;
	}
	if ((arr.oscIndex == -999) || (arr.length == 0)) {
		oscNode = audioContext.createOscillator();
		oscNode.type = type;
		oscNode.frequency.value = frequencyFromNoteNumber(note);
		arr.push(oscNode);
		arr.oscIndex = arr.length-1;
	}
	else {
		arr[arr.oscIndex].type = type;
		arr[arr.oscIndex].frequency.value = frequencyFromNoteNumber(note);
	}
}

function ringMod(arr) {
	oscillator(arr, 1);
	if (arr.length == 0)
		return;
	else if (document.getElementById('ringMod').checked) {
		ringModNode = audioContext.createOscillator();
		ringModNode.type = 3;
		ringModNode.frequency.value = frequencyFromNoteNumber(note);
		arr.push(ringModNode);
		arr.ringModIndex = arr.length-1;
		stopAll();
		playAll();	 
	}
	else {
		arr.splice(arr.ringModIndex, 1);
		arr.ringModIndex = -999;
		stopAll();
		playAll();
	}
}
function noise(arr) {
	if (arr.length == 0)
		oscillator(arr,1);
	var length =  2 * audioContext.sampleRate;
    noiseBuffer = audioContext.createBuffer( 1, length, audioContext.sampleRate);
    var bufferData = noiseBuffer.getChannelData( 0 );
    for (var i = 0; i < length; ++i) {
    	bufferData[i] = (2*Math.random() - 1);
	}
	var noiseNode = audioContext.createBiquadFilter();
	noiseNode.buffer = noiseBuffer;
	noiseNode.type = 0; 
	noiseNode.frequency.value = frequencyFromNoteNumber(note); // Set cutoff to 440 HZ
	arr.push(noiseNode);
	arr.noiseIndex = arr.length-1;
}

function ADSR(arr){
	if (arr.length == 0)
		return;
	else if (document.getElementById('ADSR').checked) {        
		envNode = audioContext.createGainNode();
		var now = audioContext.currentTime;
		var envAttackEnd = now + (currentEnvA/10.0);
		envNode.gain.value = 0.0;
		envNode.gain.setValueAtTime( 0.0, now );
		envNode.gain.linearRampToValueAtTime( 1.0, envAttackEnd );
		envNode.gain.setTargetValueAtTime( (currentEnvS/100.0), envAttackEnd, (currentEnvD/100.0)+0.001 );
		arr.push(envNode);
		arr.envIndex = arr.length - 1;
		stopAll();
		playAll();
	}
	else {
		arr.splice(arr.envIndex, 1);
		arr.envIndex = -999;
		stopAll();
		playAll();
	}
}

function stopAll() {
	if (sounds1[0] != null) {
		sounds1[0].disconnect();
		sounds1.isPlaying = false;

	}
	if (sounds2[0] != null) {
		sounds2[0].disconnect();
		sounds2.isPlaying = false;

	}
	if (sounds3[0] != null) {
		sounds3[0].disconnect();
		sounds3.isPlaying = false;

	}
}

function volume() {
	volNode = audioContext.createGainNode();
	volNode.gain.value = document.getElementById("volume").value;
	stopAll();
	playAll();
}

function play(arr) {
	if (arr.length != 0) {
		for (i=0; i<arr.length-1; i++){
			arr[i].connect(arr[i+1]);
		}
		arr.isPlaying = true;
		console.log(arr);
	}
}

function playAll() {
	play(sounds1);
	play(sounds2);
	play(sounds3);
	var connectNode;
	volNode.connect(audioContext.destination);
	if (filter != null)
		connectNode = filter;
	else
		connectNode = volNode;
	if (sounds1.length != 0) {
		sounds1[sounds1.length-1].connect(connectNode);
		sounds1[0].start(0);
	}
	if (sounds2.length != 0) {
		sounds2[sounds2.length-1].connect(connectNode);
		sounds2[0].start(0);
	}
	if (sounds3.length != 0) {
		sounds3[sounds3.length-1].connect(connectNode);
		sounds3[0].start(0);
	}
	if (filter != null)
		filter.connect(volNode);
}

function togglePlayPause(arr, btn) {
   var playpause = document.getElementById("playpause"+btn);
   //console.log(playpause);
   if (arr.length == 0) {
		window.alert("Please first select a sound waveform.")
	}
   else if (arr.isPlaying) {
      playpause.title = "Play";
      playpause.innerHTML = "Play";
      stopAll();
   }
   else {
      playpause.title = "Stop";
      playpause.innerHTML = "Stop";
      playAll();
   }
}

function displayFreq() {
	var freq = document.getElementById("freq");
	freq.innerHTML = Math.round(frequencyFromNoteNumber(note))+ "Hz";
}

function pass(type) {
	if (type != null) {
		filter = audioContext.createBiquadFilter();
		filter.type = type; 
		var freq = document.getElementById("filterfreq-slider").value;
		filter.frequency.value = freq; // Set cutoff to 440 HZ
		stopAll();
		playAll();
	}
	else {
		filter = null;
	}
}

function updateFreq() {
	var freq = document.getElementById("filterfreq-slider").value;
	if (filter != null)
		filter.frequency.value = freq;
	document.getElementById("filterfreq").innerHTML = Math.round(freq)+"Hz";
}

function updateNote(arr) {
	if (arr.oscIndex != -999)
		arr[parseInt(arr.oscIndex)].frequency.value = frequencyFromNoteNumber(note);
	if (arr.ringModIndex != -999)
		arr[parseInt(arr.ringModIndex)].frequency.value = frequencyFromNoteNumber(note);
	if (arr.noiseIndex != -999)
		arr[parseInt(arr.noiseIndex)].frequency.value = frequencyFromNoteNumber(note);
	if (filter != null)
		filter.frequency.value = frequencyFromNoteNumber(note);
}

window.onload=initAudio;
