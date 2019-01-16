
const fs = require('fs');
const PulseAudio = require('pulseaudio2');

function main() {
    let pulseCtx = new PulseAudio();
    let stream = pulseCtx.createRecordStream({ format: 'S16LE', rate: 16000, channels: 1 });
    stream.on('state', (state) => {
        if (state === 'ready')
            console.log('Speak now...');
    });

    let output = fs.createWriteStream('output.wav');
    let riffHeader = Buffer.alloc(44);
    // the size of the chunks are chosen based on what GStreamer produces by default
    riffHeader.write('RIFF', 0);
    riffHeader.writeInt32LE(0x7fff0024, 4);
    riffHeader.write('WAVE', 8);
    riffHeader.write('fmt ', 12);
    riffHeader.writeInt32LE(16, 16); // fmt pkt size
    riffHeader.writeInt16LE(1, 20); // format (1 = PCM)
    riffHeader.writeInt16LE(1, 22); // number of channels
    riffHeader.writeInt32LE(16000, 24); // sample rate
    riffHeader.writeInt32LE((16000 * 16 * 1)/8, 28); // byterate
    riffHeader.writeInt16LE((16 * 1)/8, 32); // byte per sample
    riffHeader.writeInt16LE(16, 34); // bits per sample
    riffHeader.write('data', 36);
    riffHeader.writeInt32LE(0x7fff0000, 40);
    output.write(riffHeader);
    //stream.pipe(output);
    stream.on('data', (chunk) => {
        console.log('Chunk of size ' + chunk.length);
        output.write(chunk)
    });
    stream.on('end', () => output.end());

    process.on('SIGINT', () => {
        stream.end();
        pulseCtx.end();
    });
}
main();
