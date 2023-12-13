// messed around with xstate library
// this doesn't do anything

import { createMachine } from 'xstate';
import queueWaitWidget from "./queueWaitWidget";
import callbackWidget from "./callbackWidget";

const ivrMachineDefinition = {
    id: "ivrMachine",
    initial: "start",
    states: {
        start: {
            on: {
                "1": { target: "queueWaitWidget" },
                "2": { target: "sendSmsWidget" }
            }
        },
        queueWaitWidget: {
            invoke: {
                src: queueWaitWidget,
                onDone: {
                    target: "callbackWidget",
                    actions: "createQueueTicket"
                }
            }
        },
        callbackWidget: {
            invoke: {
                src: callbackWidget,
                onDone: {
                    target: "end"
                }
            }
        },
        sendSmsWidget: {
            invoke: {
                src: event => console.log(event),
                onDone: {
                    target: "end"
                }
            }
        },
        end: {
            type: "final"
        }
    }
};

const ivrMachine = createMachine(ivrMachineDefinition);

const ivrService = interpret(ivrMachine)
    .onTransition((state) => console.log(state.context))

  ivrService.start()