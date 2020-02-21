import React from 'react';

import Bubble from './Bubble';
import './TextBubble.scss';

interface LinkBubbleProps {
  text: string;
  url: string;
  fromUser: boolean;
}

export default (props: LinkBubbleProps) => {
  return (
    <Bubble fromUser={props.fromUser} padding>
      <p>
        <b className="text-bubble-content">
          <a href={props.url} target="_blank">
            {props.text}
          </a>
        </b>
      </p>{' '}
    </Bubble>
  );
};
