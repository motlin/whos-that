import {initHome, titleScreen} from "./game/screens.ts";
import {initStyle} from "./game/settings.ts";
import {initSound} from "./game/sound.ts";
import {registerServiceWorker} from "./pwa/register.ts";

initSound();
initStyle();
initHome();
titleScreen();
registerServiceWorker();
