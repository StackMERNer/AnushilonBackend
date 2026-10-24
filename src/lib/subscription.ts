import { ISubjectSubscription, IUser } from "../models/User";

export function hasActiveSubscription(user: IUser): boolean {
  const { subscription } = user;

  if (!subscription) {
    return false;
  }

  return new Date(subscription.expiresAt) > new Date();
}

export const hasAllSubjectsActiveSubscription = (
  user: IUser,
  selectedSubjectIds: string[],
): boolean => {
  if (selectedSubjectIds.length === 0) {
    return false;
  }

  const subjectSubscriptions = user.subjectWiseSubscription ?? [];

  return selectedSubjectIds.every((subjectId) => {
    const subscription = subjectSubscriptions.find((sub) =>
      sub.subjectId.equals(subjectId),
    );

    return (
      subscription !== undefined && hasActiveSubjectSubscription(subscription)
    );
  });
};
export const hasActiveSubjectSubscription = (
  subjectSubscription: ISubjectSubscription,
) => {
  return new Date(subjectSubscription.expiresAt) > new Date();
};
