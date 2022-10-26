import * as t from 'ts-interface-checker';

// this was created manually, not with ts-interface-builder

export const SystemAlertTI = t.iface([], {
	dismissable: 'boolean',
	id: 'string',
	level: t.union(t.lit('error'), t.lit('info'), t.lit('warning')),
	message: t.opt('string'),
	title: 'string',
});

const exportedTypeSuite: t.ITypeSuite = {
	SystemAlertTI,
};
export default exportedTypeSuite;
