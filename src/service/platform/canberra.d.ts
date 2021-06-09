// TODO move to upstream repo
declare module 'canberra' {
    export class Context {
        constructor(props ?: Record<string, string>);

        destroy() : void;

        cancel(id : number) : void;

        cache(props : Record<string, string>) : void;

        playing(id : number) : boolean;

        play(id : number, props : Record<string, string>) : Promise<void>;
    }

    export enum Error {
        SUCCESS,
        NOTSUPPORTED,
        INVALID,
        STATE,
        OOM,
        NODRIVER,
        SYSTEM,
        CORRUPT,
        TOOBIG,
        NOTFOUND,
        DESTROYED,
        CANCELED,
        NOTAVAILABLE,
        ACCESS,
        IO,
        INTERNAL,
        DISABLED,
        FORKED,
        DISCONNECTED,
    }

    export namespace Property {
        export const MEDIA_NAME : string;
        export const MEDIA_TITLE : string;
        export const MEDIA_ARTIST : string;
        export const MEDIA_LANGUAGE : string;
        export const MEDIA_FILENAME : string;
        export const MEDIA_ICON : string;
        export const MEDIA_ICON_NAME : string;
        export const MEDIA_ROLE : string;

        export const EVENT_ID : string;
        export const EVENT_DESCRIPTION : string;
        export const EVENT_MOUSE_X : string;
        export const EVENT_MOUSE_Y : string;
        export const EVENT_MOUSE_HPOS : string;
        export const  EVENT_MOUSE_VPOS : string;
        export const EVENT_MOUSE_BUTTON : string;

        export const WINDOW_NAME : string;
        export const WINDOW_ID : string;
        export const WINDOW_ICON : string;
        export const WINDOW_ICON_NAME : string;
        export const WINDOW_X11_DISPLAY : string;
        export const WINDOW_X11_SCREEN : string;
        export const WINDOW_X11_MONITOR : string;
        export const WINDOW_X11_XID : string;

        export const APPLICATION_NAME : string;
        export const APPLICATION_ID : string;
        export const APPLICATION_VERSION : string;
        export const APPLICATION_ICON : string;
        export const APPLICATION_ICON_NAME : string;
        export const APPLICATION_LANGUAGE : string;
        export const APPLICATION_PROCESS_ID : string;
        export const APPLICATION_PROCESS_BINARY : string;
        export const APPLICATION_PROCESS_USER : string;
        export const APPLICATION_PROCESS_HOST : string;

        export const CANBERRA_CACHE_CONTROL : string;
        export const CANBERRA_VOLUME : string;
        export const CANBERRA_XDG_THEME_NAME : string;
        export const CANBERRA_XDG_THEME_OUTPUT_PROFILE : string;
    }
}
