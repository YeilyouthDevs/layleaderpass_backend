import { Order } from "sequelize";

export function setIf(condition: any, definition: any): any | any[] | undefined {
  if (condition) return definition;
  else if (Array.isArray(definition)) return [];
  else return undefined;
}

interface OrderSchema {
  when: string;
  order: Order;
}

interface SwitchCase<T> {
  when: any;
  then: T;
}

interface SwitchOption<T> {
  default: T;
  cases?: SwitchCase<T>[];
}

export function switchOrder(key: string | undefined, defaultOrder: Order, orderShchema?: OrderSchema[]) {
  if (orderShchema) {
    for (const schema of orderShchema) {
      if (schema.when === key) return schema.order;
    }
  }
  return defaultOrder;
}

export function switchAs<T>(key: string | undefined, option: SwitchOption<T>) {
  if (option.cases) {
    for (const theCase of option.cases) {
      if (theCase.when === key) return theCase.then;
    }
  }

  return option.default;
}

export async function optionalModify({ targetInst, changes, onChanged }: {
  targetInst: any;
  changes: Array<[string, any]>;
  onChanged: () => Promise<any> | any;
}) {
  console.log('targetInst:', targetInst, 'changes:', changes, 'onChanged:', onChanged)

  let isModified = false;

  changes.forEach(([key, newValue]) => {
      console.log(targetInst[key], newValue)

      if (targetInst[key] !== newValue) {
          targetInst[key] = newValue;
          isModified = true;
      }
  });


  console.log('ismodified', isModified)
  if (isModified) {
    return await onChanged();
  }

  return Promise.resolve();  // 변경이 없으면 즉시 resolved된 Promise 반환
}
