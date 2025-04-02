import type { Scope } from "./Scope/Scope";

interface MemoizationProtocol<
	MemoizedData extends object,
	Argv extends unknown[],
	StorageKeySource extends string = string,
> {
	(storage: Map<StorageKeySource, MemoizedData>, scope?: Scope, ...args: Argv): MemoizedData;
}

export function memoizationFactory<
	MemoizedData extends object,
	ProcessArgv extends unknown[],
	StorageKeySource extends string = string,
>(executor: MemoizationProtocol<MemoizedData, ProcessArgv, StorageKeySource>) {
	return function memoizationCreator(
		scope: Scope,
		storage: Map<StorageKeySource, MemoizedData> = new Map(),
	) {
		return {
			push(...args: [id: StorageKeySource, data: MemoizedData][]) {
				for (const [id, data] of args) {
					storage.set(id, data);
				}
			},
			process(...args: ProcessArgv) {
				return executor(storage, scope, ...args);
			},
			get(id: StorageKeySource): MemoizedData | undefined {
				let data: MemoizedData | undefined;

				if (!(data = storage.get(id))) {
					return undefined;
				}

				return data;
			},
			getAll() {
				return Object.fromEntries(storage);
			},
			get size() {
				return storage.size;
			},
		};
	};
}
