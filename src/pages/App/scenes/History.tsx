import React, { useEffect, useMemo } from 'react';
import { Tabs } from 'antd';
import { BarsOutlined, AppstoreOutlined } from '@ant-design/icons';

import GroupedItems, { GroupedItemsType } from '../components/GroupedItems';
import SaveClipboardModal from '../components/SaveClipboardModal';
import { useAppContext } from '../hooks/useAppContext';
import { useModalContext } from '../hooks/useModalContext';
import { uuid } from '../../../utils/uuid';
import { Category, ClipboardItem } from '../../../types';

const groupItemsByDate = (items: ClipboardItem[]) => {
  return items.reduce((acc, item) => {
    const date = new Date(item.timestamp).toLocaleDateString('en-CA');

    if (!acc[date]) {
      acc[date] = [];
    }

    acc[date].push(item);

    return acc;
  }, {} as Record<string, ClipboardItem[]>);
};

const groupItemsByCategory = (
  items: ClipboardItem[],
  categories: Category[]
) => {
  const grouped = categories.reduce((acc, category) => {
    acc[category.name] = [];
    return acc;
  }, {} as Record<string, ClipboardItem[]>);

  items.forEach((item) => {
    const categoryName = item.category?.name;
    if (categoryName && grouped[categoryName]) {
      grouped[categoryName].push(item);
    }
  });

  return Object.fromEntries(
    Object.entries(grouped).filter(([, items]) => items.length > 0)
  );
};

const History = () => {
  const { clipboardItems, setClipboardItems, categories, setCategories } =
    useAppContext();
  const { setIsModalOpen } = useModalContext();

  const groupedItemsByDate = useMemo(
    () => groupItemsByDate(clipboardItems),
    [clipboardItems]
  );
  const groupedItemsByCategory = useMemo(
    () => groupItemsByCategory(clipboardItems, categories),
    [clipboardItems]
  );

  useEffect(() => {
    const fetchClipboardHistory = () => {
      chrome.storage.local.get(['clipboardHistory'], ({ clipboardHistory }) => {
        if (clipboardHistory) {
          setClipboardItems(clipboardHistory);
        }
      });
    };

    fetchClipboardHistory();
  }, []);

  useEffect(() => {
    const fetchCategories = () => {
      chrome.storage.local.get(['categories'], ({ categories }) => {
        if (categories) {
          setCategories(categories);
        }
      });
    };

    fetchCategories();
  }, [setCategories]);

  const handleCreateCategory = (categoryName: string) => {
    const trimmedCategoryName = categoryName.trim().toLowerCase();

    chrome.storage.local.get(['categories'], ({ categories }) => {
      const categoryExists = categories.some(
        (category: Category) =>
          category.name.trim().toLowerCase() === trimmedCategoryName
      );

      if (categoryExists) {
        alert(`Category "${categoryName}" already exists.`);
        return null;
      }

      const newCategory: Category = {
        id: uuid(),
        name: categoryName.trim(),
      };

      const updatedCategories = [...categories, newCategory];

      chrome.storage.local.set({ categories: updatedCategories }, () => {
        setCategories(updatedCategories);
      });
    });
  };

  const handleSaveClipboardItemToCategory = async (
    itemId: string,
    categoryName: string
  ) => {
    const category = await ensureCategoryExists(categoryName);

    chrome.storage.local.get(['clipboardHistory'], ({ clipboardHistory }) => {
      const updatedItems = clipboardHistory.map((item: ClipboardItem) =>
        item.id === itemId ? { ...item, category } : item
      );

      chrome.storage.local.set({ clipboardHistory: updatedItems }, () => {
        setClipboardItems(updatedItems);
        setIsModalOpen(false);
      });
    });
  };

  const ensureCategoryExists = async (
    categoryName: string
  ): Promise<Category | null> => {
    try {
      const trimmedCategoryName = categoryName.trim().toLowerCase();

      const result = await chrome.storage.local.get(['categories']);
      const categories: Category[] = Array.isArray(result.categories)
        ? result.categories
        : [];

      let category = categories.find(
        (c) => c.name.trim().toLowerCase() === trimmedCategoryName
      );

      if (!category) {
        category = {
          id: uuid(),
          name: categoryName.trim(),
        };

        const updatedCategories = [...categories, category];

        await chrome.storage.local.set({ categories: updatedCategories });
      }

      return category;
    } catch (error) {
      console.error('Error ensuring category existence:', error);
      return null;
    }
  };

  const GroupedByDate: React.FC<{
    groupedItems: GroupedItemsType;
  }> = ({ groupedItems }) => {
    return <GroupedItems groupedItems={groupedItems} groupName="date" />;
  };

  const GroupedByCategory: React.FC<{
    groupedItems: GroupedItemsType;
  }> = ({ groupedItems }) => {
    return <GroupedItems groupedItems={groupedItems} groupName="category" />;
  };

  return (
    <>
      <SaveClipboardModal
        onCreateCategory={handleCreateCategory}
        onSaveClipboard={handleSaveClipboardItemToCategory}
      />
      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: '1',
            label: 'By date',
            children: <GroupedByDate groupedItems={groupedItemsByDate} />,
            icon: <BarsOutlined />,
          },
          {
            key: '2',
            label: 'By category',
            children: (
              <GroupedByCategory groupedItems={groupedItemsByCategory} />
            ),
            icon: <AppstoreOutlined />,
          },
        ]}
      />
    </>
  );
};

export default History;
