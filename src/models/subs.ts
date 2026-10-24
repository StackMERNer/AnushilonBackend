const purchaseDemo = {
  _id: "objectId",
  durationDays: 365,
  type: "purchase", // or rewnew
  paymentMethod: "bKash",
  transactionId: "bKash-1234567890",
  paymentStatus: "pending",
  classes: [
    {
      classId: "objectId",
      subjects: ["sub1", "sub2"],
    },
  ],
};

const demoSubscriptionDoc = {
  _id: "objectId",
  userId: "objectId", // one subscription doc per user per plan type
  type: "question_paper_create", // might later add lecture sheet etc.
  classes: [
    {
      className: "Class 6",
      classId: "objectId",
      subjects: [
        {
          subjectName: "Bangla 1st",
          subjectId: "objectId",
          startedAt: "2023-01-01",
          expiresAt: "2023-01-01",
        },
        {
          subjectName: "English 1st",
          subjectId: "objectId",
          startedAt: "2023-01-01",
          expiresAt: "2023-01-01",
        },
      ],
    },
    {
      className: "Class 7",
      classId: "objectId",
      subjects: [
        {
          subjectName: "Maths 2nd",
          subjectId: "objectId",
          startedAt: "2023-01-01",
          expiresAt: "2023-01-01",
        },
        {
          subjectName: "Science",
          subjectId: "objectId",
          startedAt: "2023-01-01",
          expiresAt: "2023-01-01",
        },
      ],
    },
  ],
};

{
  classes: [
    {
      className: "Class 6",
      classId: "objectId",
      subjects: [
        {
          subjectName: "Bangla 1st",
          subjectId: "objectId",
          startedAt: "2023-01-01",
          expiresAt: "2023-01-01",
        },
        {
          subjectName: "English 1st",
          subjectId: "objectId",
          startedAt: "2023-01-01",
          expiresAt: "2023-01-01",
        },
      ],
    },
  ];
}

{
  subjects: [
    {
      subjectId: "",
      classId: "objectId",
      startedAt: "2023-01-01",
      expiresAt: "2023-01-01",
    },
  ];
}

// db.classes.updateMany(
//   {},
//   {
//     $set: {
//       pricing: [
//         {
//           scope: "whole_class",
//           durationDays: 30,
//           price: 100,
//         },
//         {
//           scope: "individual_subject",
//           durationDays: 30,
//           price: 30,
//         },
//         {
//           scope: "whole_class",
//           durationDays: 180,
//           price: 500,
//         },
//         {
//           scope: "individual_subject",
//           durationDays: 180,
//           price: 100,
//         },
//         {
//           scope: "whole_class",
//           durationDays: 365,
//           price: 800,
//         },
//         {
//           scope: "individual_subject",
//           durationDays: 365,
//           price: 150,
//         },
//       ],
//     },
//   },
// );
