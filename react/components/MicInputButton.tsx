import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faMicrophoneSlash
} from '@fortawesome/free-solid-svg-icons';
import MicStream from 'microphone-stream';
import WebSocket from 'isomorphic-ws';

interface MicInputButtonProps {
  submit: (d: any) => void;
}

const MicInputButton: React.FC<MicInputButtonProps> = props => {
  const [isRecording, setIsRecording] = useState(false);
  const [micStream, setMicStream] = useState(null as any);
  const [socketState, setSocketState] = useState(null as any);
  const voiceURL = 'localhost:8000/stt';
  // const socket = useRef(new WebSocket(`ws://${voiceURL}`, []));

  const turnRecordOff = (): void => {
    micStream.stop();
    setIsRecording(false);
    socketState.close();
    //socket.current.close();
  };

  const toggleRecord = async (): Promise<void> => {
    if (isRecording) {
      turnRecordOff();
      return;
    }

    const socket = new WebSocket(`ws://${voiceURL}`, []);
    socket.onmessage = (msg): void => {
      console.log('Message!', msg);
    };
    setSocketState(socket);

    // toggle recording state
    setIsRecording(!isRecording);

    const st: MediaTrackConstraints = {};

    const ms = new MicStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
        sampleRate: 16000,
        sampleSize: 1,
      },
      video: false
    });

    ms.setStream(stream);

    ms.on('data', (chunk: any) => {
      socket.send(chunk);
    });

    ms.on('format', (fmt: any) => {
      console.log(fmt);
    });

    // using ms before setting because setting time is unreliable
    setMicStream(ms);
  };

  return (
    <button
      id="micInputButton"
      className="chat-voice-button"
      onClick={toggleRecord}
    >
      <FontAwesomeIcon
        icon={isRecording ? faMicrophoneSlash : faMicrophone}
        color="white"
        size="1x"
      />
    </button>
  );
};

export default MicInputButton;
