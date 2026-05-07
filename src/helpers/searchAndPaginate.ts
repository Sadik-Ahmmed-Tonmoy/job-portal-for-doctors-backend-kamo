import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export  const searchAndPaginate = async <
  ModelDelegate extends {
    findMany: Function;
    count: Function;
  },
  WhereInput extends Record<string, any>,
  Select extends object | null = null,
  Include extends object | null = null
>(
  model: ModelDelegate,
  searchableFields: (keyof WhereInput)[] = [],
  page: number = 1,
  limit: number = 10,
  searchQuery: string = "",
  additionalFilter?: WhereInput,
  options?: {
    select?: Select;
    include?: Include;
  },
  orderField?: keyof WhereInput,
  orderPosition: "asc" | "desc" = "desc"
) => {
  const skip = (page - 1) * limit;

  let searchFilter: Record<string, any> = {};

  if (searchQuery && searchableFields.length > 0) {
    searchFilter.OR = searchableFields.map((field) => ({
      [field as string]: {
        contains: searchQuery,
        mode: "insensitive",
      },
    }));
  }

  const finalWhere = {
    ...searchFilter,
    ...(additionalFilter ?? {}),
  };

  const queryOptions: any = {
    where: finalWhere,
    skip,
    take: limit,
    orderBy: orderField ? { [orderField as string]: orderPosition } : undefined,
    ...options,
  };

  const data = await (model as any).findMany(queryOptions);
  const total = await (model as any).count({ where: finalWhere });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data,
  };
};
