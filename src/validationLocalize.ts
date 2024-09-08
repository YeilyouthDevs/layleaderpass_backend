interface LocalFieldNames {
  [key: string]: string;
}

const localFieldName: LocalFieldNames = {
  password: "비밀번호",
  email: "이메일",
  birthday: "생일",
  phone: "연락처",
};

function getLocalName(fieldName: string) {
  return localFieldName[fieldName] || fieldName;
}

// 오류 메시지 생성 함수
export function generateCustomErrorMessage(validationErrors: any[]): string {
  return validationErrors
    .map((err) => {
      const fieldName = getLocalName(err.instancePath.split("/").pop()); // 필드 이름 추출 및 로컬화
      switch (err.keyword) {
        case "minLength":
          return `${getLocalName(fieldName)} 은(는) 최소 ${
            err.params.limit
          }글자 이상이어야 합니다.`;
        case "maxLength":
          return `${getLocalName(fieldName)} 은(는) 최대 ${
            err.params.limit
          }글자를 넘을 수 없습니다.`;
        case "minimum":
          return `${getLocalName(fieldName)} 은(는) 최소값 ${
            err.params.limit
          } 이상이어야 합니다.`;
        case "maximum":
          return `${getLocalName(fieldName)} 은(는) 최대값 ${
            err.params.limit
          } 을(를) 넘을 수 없습니다.`;
        case "pattern":
          return `${getLocalName(
            fieldName
          )} 은(는) 지정된 패턴과 일치해야 합니다.`;
        case "additionalProperties":
          return `불필요한 값 ${getLocalName(
            err.params.additionalProperty
          )} 은(는) 허용되지 않습니다.`;
        case "type":
          return `${getLocalName(fieldName)}의 타입이 올바르지 않습니다. ${
            err.params.type
          } 이어야 합니다.`;
        case "enum":
          return `${getLocalName(
            fieldName
          )} 은(는) 다음 중 하나여야 합니다: ${err.params.allowedValues.join(
            ", "
          )}`;
        case "required":
          return `${getLocalName(fieldName)} 은(는) 필수값입니다.`;
        default:
          return `${getLocalName(fieldName)}의 값이 올바르지 않습니다.`; // 기본 메시지
      }
    })
    .join(", ");
}
