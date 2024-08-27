'use client';

import clsx from "clsx";
import MarkdownRenderer from "./MarkdownRenderer";

const Message = ({message, isUser}) => {
  return (
    <div className={clsx('flex w-full my-6', isUser ? 'justify-end' : 'justify-start')}>
        <div className={clsx(
          'max-w-[90%] md:max-w-[80%] p-4 rounded-lg text-sm',
          isUser
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 text-slate-800 rounded-bl-none'
        )}>
            <MarkdownRenderer content={message} />
        </div>
    </div>
  );
}

export default Message