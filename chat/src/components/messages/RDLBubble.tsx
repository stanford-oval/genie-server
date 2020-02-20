import React from 'react';

import Bubble from './Bubble';
import './RDLBubble.scss';

interface Props {
  fromUser: boolean;
  image?: URL;
  link: URL;
  text?: string;
  title?: string;
}

export default (props: Props) => {
  return (
    <Bubble className="rdl-bubble" fromUser={props.fromUser}>
      {props.image ? (
        <div
          className="rdl-bubble-image"
          style={{ background: `url(${props.image}) no-repeat center` }}
        />
      ) : null}
      <div className="rdl-bubble-body">
        <h1 className="rdl-bubble-title">
          <a href={`${props.link}`}>{props.title}</a>
        </h1>
        <p className="rdl-bubble-text">{props.text}</p>
      </div>
    </Bubble>
  );
};
