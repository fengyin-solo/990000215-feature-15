<template>
  <div class="home">
    <el-row :gutter="20">
      <el-col :span="18">
        <h2 class="page-title">
          {{ pageTitle }}
          <el-tag v-if="searchQuery" type="info" class="search-tag" closable @close="clearSearch">
            搜索: {{ searchQuery }}
          </el-tag>
        </h2>

        <div v-if="meta.currentSummary" class="result-meta">
          <span class="summary-text">{{ meta.currentSummary.text }}</span>
          <el-button
            v-if="meta.nextPage && meta.nextPage.hasNext"
            size="small"
            class="next-page-hint"
            @click="goToNextPage"
          >
            下一页（第 {{ meta.nextPage.page }} 页，剩余 {{ meta.nextPage.remaining }} 篇）
          </el-button>
        </div>

        <div v-loading="loading">
          <ArticleCard
            v-for="article in articles"
            :key="article.id"
            :article="article"
            :highlight-query="searchQuery"
            @tag-click="handleTagSelect"
          />
          
          <el-empty v-if="!loading && articles.length === 0" :description="emptyDescription" />
        </div>
        
        <Pagination
          v-model="currentPage"
          :total="pagination.total"
          :page-size="pagination.limit"
          @change="handlePageChange"
        />
      </el-col>
      
      <el-col :span="6">
        <TagFilter
          :tags="tags"
          :selected-tag="selectedTag"
          @select="handleTagSelect"
        />
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../api'
import ArticleCard from '../components/ArticleCard.vue'
import TagFilter from '../components/TagFilter.vue'
import Pagination from '../components/Pagination.vue'

const route = useRoute()
const router = useRouter()

const articles = ref([])
const tags = ref([])
const loading = ref(false)
const selectedTag = ref(null)
const searchQuery = ref('')
const currentPage = ref(1)
const pagination = ref({
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0
})
const meta = ref({
  availableTags: [],
  currentSummary: null,
  nextPage: { hasNext: false }
})

const pageTitle = computed(() => {
  if (searchQuery.value) {
    return '搜索结果'
  }
  return selectedTag.value ? `标签: ${selectedTag.value}` : '最新文章'
})

const emptyDescription = computed(() => {
  if (searchQuery.value) {
    return '未找到匹配的文章'
  }
  return '暂无文章'
})

onMounted(() => {
  if (route.query.tag) {
    selectedTag.value = route.query.tag
  }
  if (route.query.search) {
    searchQuery.value = route.query.search
  }
  fetchArticles()
  fetchTags()
})

watch(() => route.query, (newQuery) => {
  if (newQuery.tag !== selectedTag.value) {
    selectedTag.value = newQuery.tag || null
  }
  if (newQuery.search !== searchQuery.value) {
    searchQuery.value = newQuery.search || ''
  }
  currentPage.value = 1
  fetchArticles()
})

async function fetchArticles() {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pagination.value.limit
    }
    if (selectedTag.value) {
      params.tag = selectedTag.value
    }
    if (searchQuery.value) {
      params.search = searchQuery.value
    }

    const response = await api.get('/articles', { params })
    articles.value = response.data.articles
    pagination.value = response.data.pagination
    meta.value = response.data.meta || meta.value

    // Available tags are scoped to the current result set; refresh the filter
    // from metadata so tags stay in sync with the articles being shown.
    if (response.data.meta && Array.isArray(response.data.meta.availableTags)) {
      tags.value = response.data.meta.availableTags
    }
  } catch (error) {
    const data = error.response?.data
    const code = data?.code
    const message = data?.details?.message || data?.error || '获取文章失败'

    if (code === 'PAGE_OUT_OF_RANGE') {
      // A stale page (e.g. URL loaded after a refresh): fall back to page 1.
      currentPage.value = 1
      ElMessage.warning(message)
      return fetchArticles()
    }

    // Distinct messaging for the remaining unified error conditions.
    ElMessage.error(message)
    articles.value = []
    pagination.value = { total: 0, page: 1, limit: pagination.value.limit, totalPages: 0 }
    meta.value = {
      availableTags: [],
      currentSummary: { text: message },
      nextPage: { hasNext: false }
    }
  } finally {
    loading.value = false
  }
}

async function fetchTags() {
  try {
    const response = await api.get('/tags')
    // Keep the global tag list only until the first scoped result metadata arrives.
    if (!meta.value.currentSummary) {
      tags.value = response.data.tags
    }
  } catch (error) {
    console.error('Failed to fetch tags:', error)
  }
}

function goToNextPage() {
  if (meta.value.nextPage?.hasNext) {
    handlePageChange(meta.value.nextPage.page)
  }
}

function handlePageChange(page) {
  currentPage.value = page
  fetchArticles()
}

function handleTagSelect(tag) {
  selectedTag.value = tag
  currentPage.value = 1
  
  const query = {}
  if (tag) query.tag = tag
  if (searchQuery.value) query.search = searchQuery.value
  
  router.replace({ query })
  fetchArticles()
}

function clearSearch() {
  const query = {}
  if (selectedTag.value) query.tag = selectedTag.value
  router.replace({ query })
}
</script>

<style scoped>
.home {
  padding-top: 20px;
}

.page-title {
  font-size: 24px;
  color: #303133;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-tag {
  font-size: 14px;
  font-weight: normal;
}

.result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.summary-text {
  color: #606266;
  font-size: 14px;
}

.next-page-hint {
  flex-shrink: 0;
}
</style>
