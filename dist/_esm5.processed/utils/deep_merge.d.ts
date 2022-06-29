declare type IDeepPartial<T> = {
    [P in keyof T]?: IDeepPartial<T[P]>;
};
declare type ISourcesArgument<T> = Array<IDeepPartial<T> | unknown>;
/**
 * Deeply merge nested objects
 * @param target
 * @param sources
 * @returns output : merged object
 */
export default function deepMerge<T>(target: T, ...sources: ISourcesArgument<T>): T;
export {};
