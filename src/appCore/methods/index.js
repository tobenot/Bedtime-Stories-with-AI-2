import { configMethods } from './configMethods';
import { chatMethods } from './chatMethods';
import { uiMethods } from './uiMethods';
import { archiveMethods } from './archiveMethods';

export const appCoreMethods = {
	...configMethods,
	...chatMethods,
	...uiMethods,
	...archiveMethods
};
