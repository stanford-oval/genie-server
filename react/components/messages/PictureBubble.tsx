import React from 'react';

import { animateScroll } from 'react-scroll';

import Bubble from './Bubble';
import './PictureBubble.scss';

interface Props {
  fromUser: boolean;
  image?: URL;
}

export default (props: Props) => {
  const onLoad = (): void => {
    // Scroll to bottom of chat feed when image dynamically loads
    animateScroll.scrollToBottom({
      containerId: 'feed',
      duration: 100
    });
  };

  return (
    <Bubble
      className="picture-bubble"
      fromUser={props.fromUser}
    >
      <img src={new String(props.image) as string} onLoad={onLoad} />
    </Bubble>
  );
};
