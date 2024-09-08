import bcrypt from "bcrypt";
const defaultPassword = bcrypt.hashSync("a12341234!", bcrypt.genSaltSync());

export function createMockAdminUserData() {
  return [
    {
      email: "user1@example.com",
      password: defaultPassword,
      name: "홍길동",
      birthday: new Date("1982-05-17T00:00:00+09:00"),
      phone: "01012345678",
      role: "ADMIN",
      talent: 0,
      acceptNo: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user2@example.com",
      password: defaultPassword,
      name: "신짱구",
      birthday: new Date("1983-07-22T00:00:00+09:00"),
      phone: "01086749689",
      role: "ADMIN",
      talent: 0,
      acceptNo: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user3@example.com",
      password: defaultPassword,
      name: "최홍만",
      birthday: new Date("1995-12-13T00:00:00+09:00"),
      phone: "01096747396",
      role: "ADMIN",
      talent: 0,
      acceptNo: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user4@example.com",
      password: defaultPassword,
      name: "박명수",
      birthday: new Date("2001-03-07T00:00:00+09:00"),
      phone: "01088934521",
      role: "ADMIN",
      talent: 0,
      acceptNo: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user5@example.com",
      password: defaultPassword,
      name: "유재석",
      birthday: new Date("1989-09-30T00:00:00+09:00"),
      phone: "01037669973",
      role: "ADMIN",
      talent: 0,
      acceptNo: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

export function createMockGuestUserData() {
  return [
    {
      email: "user6@example.com",
      password: defaultPassword,
      name: "이민아",
      birthday: new Date("1990-04-11T00:00:00+09:00"),
      phone: "01023456789",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user7@example.com",
      password: defaultPassword,
      name: "신짱아",
      birthday: new Date("1993-04-25T00:00:00+09:00"),
      phone: "01018954829",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user8@example.com",
      password: defaultPassword,
      name: "홍수정",
      birthday: new Date("1985-07-19T00:00:00+09:00"),
      phone: "01029486759",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user9@example.com",
      password: defaultPassword,
      name: "박지성",
      birthday: new Date("1991-11-02T00:00:00+09:00"),
      phone: "01037594628",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user10@example.com",
      password: defaultPassword,
      name: "이지은",
      birthday: new Date("1990-11-15T00:00:00+09:00"),
      phone: "01098765432",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user11@example.com",
      password: defaultPassword,
      name: "김수현",
      birthday: new Date("1988-02-16T00:00:00+09:00"),
      phone: "01045678901",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user12@example.com",
      password: defaultPassword,
      name: "차태현",
      birthday: new Date("1971-03-25T00:00:00+09:00"),
      phone: "01078901234",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user13@example.com",
      password: defaultPassword,
      name: "이병훈",
      birthday: new Date("1993-09-08T00:00:00+09:00"),
      phone: "01023456789",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user14@example.com",
      password: defaultPassword,
      name: "김영철",
      birthday: new Date("1984-12-07T00:00:00+09:00"),
      phone: "01056789012",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user15@example.com",
      password: defaultPassword,
      name: "김태리",
      birthday: new Date("1990-04-20T00:00:00+09:00"),
      phone: "01089012345",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user16@example.com",
      password: defaultPassword,
      name: "전혜빈",
      birthday: new Date("1985-02-22T00:00:00+09:00"),
      phone: "01023456789",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user17@example.com",
      password: defaultPassword,
      name: "하지원",
      birthday: new Date("1979-03-10T00:00:00+09:00"),
      phone: "01056789012",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user18@example.com",
      password: defaultPassword,
      name: "박보영",
      birthday: new Date("1990-02-12T00:00:00+09:00"),
      phone: "01089012345",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user19@example.com",
      password: defaultPassword,
      name: "유승호",
      birthday: new Date("1993-08-17T00:00:00+09:00"),
      phone: "01023456789",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user20@example.com",
      password: defaultPassword,
      name: "이제훈",
      birthday: new Date("1984-12-19T00:00:00+09:00"),
      phone: "01056789012",
      role: "GUEST",
      talent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

export function createMockUserData() {
  return [
    {
      email: "user21@example.com",
      password: defaultPassword,
      name: "박준형",
      birthday: new Date("1995-02-28T00:00:00+09:00"),
      phone: "01098765432",
      role: "USER",
      talent: 0,
      acceptNo: 6,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user22@example.com",
      password: defaultPassword,
      name: "김개똥",
      birthday: new Date("1998-03-15T00:00:00+09:00"),
      phone: "01049874571",
      role: "USER",
      talent: 0,
      acceptNo: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user23@example.com",
      password: defaultPassword,
      name: "김연아",
      birthday: new Date("1997-05-08T00:00:00+09:00"),
      phone: "01058746932",
      role: "USER",
      talent: 0,
      acceptNo: 8,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user24@example.com",
      password: defaultPassword,
      name: "손흥민",
      birthday: new Date("1996-03-14T00:00:00+09:00"),
      phone: "01079856431",
      role: "USER",
      talent: 0,
      acceptNo: 9,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user25@example.com",
      password: defaultPassword,
      name: "한지민",
      birthday: new Date("1992-05-30T00:00:00+09:00"),
      phone: "01098765432",
      role: "USER",
      talent: 0,
      acceptNo: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user26@example.com",
      password: defaultPassword,
      name: "송혜교",
      birthday: new Date("1981-02-26T00:00:00+09:00"),
      phone: "01045678901",
      role: "USER",
      talent: 0,
      acceptNo: 11,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user27@example.com",
      password: defaultPassword,
      name: "이민호",
      birthday: new Date("1987-06-22T00:00:00+09:00"),
      phone: "01078901234",
      role: "USER",
      talent: 0,
      acceptNo: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user28@example.com",
      password: defaultPassword,
      name: "한효주",
      birthday: new Date("1987-02-22T00:00:00+09:00"),
      phone: "01023456789",
      role: "USER",
      talent: 0,
      acceptNo: 13,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user29@example.com",
      password: defaultPassword,
      name: "김수현",
      birthday: new Date("1988-02-25T00:00:00+09:00"),
      phone: "01056789012",
      role: "USER",
      talent: 0,
      acceptNo: 14,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user30@example.com",
      password: defaultPassword,
      name: "박신양",
      birthday: new Date("1985-08-04T00:00:00+09:00"),
      phone: "01089012345",
      role: "USER",
      talent: 0,
      acceptNo: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user31@example.com",
      password: defaultPassword,
      name: "신민아",
      birthday: new Date("1984-05-25T00:00:00+09:00"),
      phone: "01023456789",
      role: "USER",
      talent: 0,
      acceptNo: 16,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user32@example.com",
      password: defaultPassword,
      name: "조인성",
      birthday: new Date("1981-12-28T00:00:00+09:00"),
      phone: "01056789012",
      role: "USER",
      talent: 0,
      acceptNo: 17,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user33@example.com",
      password: defaultPassword,
      name: "김래원",
      birthday: new Date("1981-08-19T00:00:00+09:00"),
      phone: "01089012345",
      role: "USER",
      talent: 0,
      acceptNo: 18,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user34@example.com",
      password: defaultPassword,
      name: "강동원",
      birthday: new Date("1981-01-18T00:00:00+09:00"),
      phone: "01023456789",
      role: "USER",
      talent: 0,
      acceptNo: 19,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      email: "user35@example.com",
      password: defaultPassword,
      name: "유아인",
      birthday: new Date("1986-10-06T00:00:00+09:00"),
      phone: "01056789012",
      role: "USER",
      talent: 0,
      acceptNo: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];
}
