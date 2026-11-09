import {initHome, titleScreen} from "./game/screens.ts";
import {initSound} from "./game/sound.ts";
import {registerServiceWorker} from "./pwa/register.ts";

initSound();
initHome();
titleScreen();
registerServiceWorker();
