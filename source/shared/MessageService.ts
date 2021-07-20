import { Subject } from 'rxjs';

const subject = new Subject();

export const MessageService = {
  sendMessage: <Type>(message: Type) => subject.next(message),
  clearMessages: () => subject.next(),
  onMessage: () => subject.asObservable(),
}