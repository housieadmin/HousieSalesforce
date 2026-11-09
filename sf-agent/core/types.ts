export type JsonValue=string|number|boolean|null|JsonValue[]|{[key:string]:JsonValue};export type JsonObject=Record<string,JsonValue>;
export interface Logger{debug(message:string,data?:JsonObject):void;info(message:string,data?:JsonObject):void;warn(message:string,data?:JsonObject):void;error(message:string,data?:JsonObject):void}
export interface EvidenceWriter{record(name:string,value:JsonValue):Promise<void>;attach(name:string,data:Uint8Array,contentType:string):Promise<string>}
export interface EngineRuntime{configDirectory:string;signal?:AbortSignal;log:Logger;evidence:EvidenceWriter}
export interface EnginePlugin<TOptions extends object=JsonObject,TEngine=unknown>{id:string;create(options:TOptions,runtime:EngineRuntime):Promise<TEngine>|TEngine}
export interface ScenarioContext{readonly operation:string;readonly inputs:JsonObject;readonly config:AgentConfig;readonly log:Logger;readonly evidence:EvidenceWriter;readonly signal?:AbortSignal;engine<T>(id:string):T}
export interface Scenario{name:string;description?:string;run(context:ScenarioContext):Promise<JsonValue|void>}
export interface PluginConfig{id:string;module:string;options?:JsonObject}
export interface OperationConfig{scenario:string;engines:string[];inputs?:JsonObject;timeoutMs?:number}
export interface AgentConfig{version:1;defaults?:{timeoutMs?:number;evidenceDirectory?:string};plugins:PluginConfig[];operations:Record<string,OperationConfig>}
export function defineScenario(scenario:Scenario):Scenario{if(!scenario.name?.trim()||typeof scenario.run!=="function")throw Error("A scenario requires a name and run function.");return scenario}