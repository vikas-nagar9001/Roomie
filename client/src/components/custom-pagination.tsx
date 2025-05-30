import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const CustomPagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 5;

    if (showEllipsis) {
      if (currentPage <= 3) {
        // Show first 3 pages + ellipsis + last page
        for (let i = 1; i <= 3; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Show first page + ellipsis + last 3 pages
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 2; i <= totalPages; i++) pages.push(i);
      } else {
        // Show first page + ellipsis + current + ellipsis + last page
        pages.push(1);
        pages.push('...');
        pages.push(currentPage);
        pages.push('...');
        pages.push(totalPages);
      }
    } else {
      // Show all pages if total pages <= 5
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    }

    return pages;
  };

  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number' && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <div className="flex items-center justify-center mt-6 w-full">
      <div className="flex items-center gap-2 p-2 bg-[#151525]/50 backdrop-blur-lg rounded-xl border border-white/10">
        {/* Previous Button */}
        <button
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-2 rounded-lg text-white/80 hover:text-white disabled:opacity-50 
                   disabled:cursor-not-allowed transition-all duration-200 hover:bg-[#6636a3]/20
                   hover:scale-105 hover:-translate-x-1"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-2">
          {getPageNumbers().map((page, index) => (
            <button
              key={index}
              onClick={() => handlePageClick(page)}
              disabled={page === '...'}
              className={`w-8 h-8 text-sm flex items-center justify-center rounded-lg transition-all duration-200
                         ${page === currentPage 
                           ? 'bg-[#6636a3]/30 text-white border border-[#6636a3] hover:bg-[#6636a3]/40' 
                           : 'text-white/80 hover:text-white hover:bg-[#6636a3]/20'} 
                         ${page !== '...' ? 'hover:scale-105' : ''} 
                         ${page === '...' ? 'cursor-default text-xs' : 'cursor-pointer'}`}
            >
              {page}
            </button>
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 rounded-lg text-white/80 hover:text-white disabled:opacity-50 
                   disabled:cursor-not-allowed transition-all duration-200 hover:bg-[#6636a3]/20
                   hover:scale-105 hover:translate-x-1"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
};
