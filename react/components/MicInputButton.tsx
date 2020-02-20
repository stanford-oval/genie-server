import React, { useState } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMicrophone,
  faMicrophoneSlash,
} from '@fortawesome/free-solid-svg-icons';

import Recorder from '../libs/recorder';

declare global {
    interface Window { webkitAudioContext: any; }
}

interface MicInputButtonProps {
  submit: (d: any) => void;
}

const MicInputButton: React.FC<MicInputButtonProps> = props => {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<any>(null);
  const [recorder, setRecorder] = useState<any>(null);

  // POST request to send audio file
  const postAudio = (blob: any) => {
    const data = new FormData();
    data.append('audio', blob);
    axios({
      method: 'post',
      url: process.env.REACT_APP_STTURL || 'http://127.0.0.1:8000/rest/stt',
      data: data,
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then(response => {
        if (response.data.success) props.submit(response.data.text);
        // Update command
        else console.log(response.data.text);
      })
      .catch(error => {
        // handle error
        console.log(error);
        console.log(error.data);
      });
  };

  const startStopRecord = () => {
    if (!isRecording) {
      // Start recording
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then(strm => {
          console.log(
            'getUserMedia() success, stream created, initializing Recorder.js ...',
          );
          const audioContext = new (window.AudioContext ||
            window.webkitAudioContext)();
          const rec: any = new Recorder(audioContext.createMediaStreamSource(strm), {
            numChannels: 1,
          });
          rec.record();
          console.log('Recording started');
          // Update state
          setIsRecording(true);
          setStream(strm);
          setRecorder(rec);
        })
        .catch(err => {
          console.log('Recording failed');
          console.log(err);
          alert("You don't seem to have a recording device enabled!");
        });
    } else {
      // Stop recording
      recorder.stop();
      stream.getAudioTracks()[0].stop();
      recorder.exportWAV((blob: any) => {
        postAudio(blob);
      });
      setIsRecording(false);
    }
  };

  return (
    <button id="micInputButton" className="chat-voice-button" onClick={startStopRecord}>
      <FontAwesomeIcon
        icon={isRecording ? faMicrophoneSlash : faMicrophone}
        color='white'
        size="1x"
      />
    </button>
  );
};

export default MicInputButton;
