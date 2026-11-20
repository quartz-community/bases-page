import { viewRegistry } from "../../registry";

import { boardViewRegistration, kanbanViewRegistration } from "./board";
import { cardsViewRegistration } from "./cards";
import { galleryViewRegistration } from "./gallery";
import { listViewRegistration } from "./list";
import { tableViewRegistration } from "./table";

export function registerBuiltinViews(): void {
  viewRegistry.register(tableViewRegistration);
  viewRegistry.register(listViewRegistration);
  viewRegistry.register(cardsViewRegistration);
  viewRegistry.register(galleryViewRegistration);
  viewRegistry.register(boardViewRegistration);
  viewRegistry.register(kanbanViewRegistration);
}
