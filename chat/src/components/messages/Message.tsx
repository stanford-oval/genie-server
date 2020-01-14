import React from 'react';

import './Message.scss';
import RDLBubble from './RDLBubble';
import TextBubble from './TextBubble';
import almondAvatar from '../../images/almond_avatar.png';
import userAvatar from '../../images/user_avatar.png';

export interface MessageType {
  key?: number;
  by: string;
  data: any;
  time: Date;
}

interface Props {
  by: string;
  data: any;
  time: Date;
}

const renderBubble = (data: any, fromUser: boolean) => {
  let bubble;

  switch (data.type) {
    case 'pending':
      bubble = <TextBubble fromUser={fromUser} text={'...'} />;
      break;
    case 'rdl':
      console.log(data);
      bubble = (
        <RDLBubble
          fromUser={fromUser}
          image={data.rdl.pictureUrl}
          link={data.rdl.webCallback}
          title={data.rdl.displayTitle}
          text={data.rdl.displayText}
        />
      );
      break;
    case 'text':
      bubble = <TextBubble fromUser={fromUser} text={data.text} />;
      break;
    default:
      bubble = <TextBubble fromUser={fromUser} text={JSON.stringify(data)} />;
  }

  return bubble;
};

const Message: React.FC<Props> = props => {
  if (props.data.type === 'askSpecial') {
    return <></>;
  }

  const fromUser = props.by === 'User';
  const bubble = renderBubble(props.data, fromUser);
  return (
    <div className={`message ${fromUser ? 'message-user' : 'message-other'}`}>
      {fromUser ? (
        <img src={userAvatar} className="avatar" />
      ) : (
        <img src={almondAvatar} className="avatar" />
      )}
      {bubble}
    </div>
  );
};

export default Message;
