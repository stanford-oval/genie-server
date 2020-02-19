import React from 'react';

import Bubble from './Bubble';
import './PictureBubble.scss';

interface Props {
  fromUser: boolean;
  image?: URL;
};

export default (props: Props) => {
  return (
    <Bubble className="picture-bubble" fromUser={props.fromUser}>
      <img src={new String(props.image) as string} /> 
    </Bubble>
  );
};
