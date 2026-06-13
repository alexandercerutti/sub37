export class AdapterNotExtendingPrototypeError extends Error {
	constructor(adapterName: string) {
		super();

		this.name = "AdapterNotExtendingPrototypeError";
		this.message = `${adapterName} does not extend BaseAdapter.

If you are the adapter developer, please ensure yourself that your adapter is correctly extending BaseAdapter from
the main package.
`;
	}
}
