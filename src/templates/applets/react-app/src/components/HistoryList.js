import React from 'react';

/**
 * Component to display history of function invocations
 * 
 * @param {Object} props - Component props
 * @param {Array} props.history - Array of history items
 * @param {Function} props.onItemClick - Callback when item is clicked
 */
function HistoryList({ history, onItemClick }) {
  // If history is empty, show message
  if (!history || history.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-medium text-gray-900">History</h2>
        <p className="text-gray-500 text-sm">No requests have been made yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">History</h2>
        <span className="text-sm text-gray-500">{history.length} item(s)</span>
      </div>
      
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                Time
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Action
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {item.success ? (
                    item.data && item.data.action ? item.data.action : 'Process'
                  ) : (
                    'Error'
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  {item.success ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Success
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Error
                    </span>
                  )}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button
                    onClick={() => onItemClick(item)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    View<span className="sr-only">, item {item.id}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HistoryList;