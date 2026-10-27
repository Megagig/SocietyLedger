-- Which kind of tenant may buy a plan (T1.3). Every existing plan stays an association plan.
ALTER TABLE "plans" ADD COLUMN     "audience" "AssociationKind" NOT NULL DEFAULT 'ASSOCIATION';
