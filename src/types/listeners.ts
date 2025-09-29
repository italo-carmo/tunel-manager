export type ListenerMap = Record<string, Listener>;

export type LigoloListeners = Listener[] | ListenerMap;

export interface Listener {
    ListenerID: number
    Agent: string
    AgentID: number
    RemoteAddr: string
    SessionID: string
    Network: string
    ListenerAddr: string
    RedirectAddr: string
    Online: boolean
}
