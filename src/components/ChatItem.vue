<template>
    <div
      class="chat-item p-3 mb-2 rounded-lg cursor-pointer flex items-center gap-2 transition-all duration-200"
      :class="active ? 'bg-primary text-white shadow-md' : 'bg-gray-50 text-primary hover:bg-primary/10 transition-colors'"
      @click="handleSwitch"
    >
      <el-icon :class="active ? 'text-white' : 'text-secondary'">
        <component :is="isProtected ? 'Lock' : 'ChatRound'" />
      </el-icon>
      <!-- 新增：标题与编辑区域 -->
      <div class="flex-1 flex items-center gap-2">
        <template v-if="!isEditing">
          <span class="chat-item-title flex-1">
            {{ chat.title || '新对话' }}
          </span>
          <el-tooltip content="重命名" placement="top">
            <el-button type="text" size="small" aria-label="重命名" @click.stop="startEditing">
              <el-icon :class="active ? 'text-white' : 'text-secondary'"><Edit /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
        <template v-else>
          <el-input
            v-model="editTitle"
            size="small"
            class="flex-1"
            @keyup.enter="saveTitle"
            @keyup.esc="cancelEditing"
            @blur="saveTitle"
          />
        </template>
      </div>
      <!-- 归档按钮 -->
      <el-tooltip content="归档" placement="top">
        <el-button
          type="text"
          class="opacity-60 hover:opacity-100 transition-opacity"
          aria-label="归档"
          @click.stop="$emit('archive', chat.id)"
        >
          <el-icon :class="active ? 'text-white' : 'text-secondary'"><FolderRemove /></el-icon>
        </el-button>
      </el-tooltip>
      <!-- 删除按钮 -->
      <el-tooltip content="删除" placement="top">
        <el-button
          type="text"
          class="opacity-60 hover:opacity-100 transition-opacity"
          aria-label="删除"
          @click.stop="confirmDelete"
        >
          <el-icon :class="active ? 'text-white' : 'text-secondary'"><Delete /></el-icon>
        </el-button>
      </el-tooltip>
    </div>
  </template>
<script>
import { ElMessageBox } from 'element-plus'
import { ChatRound, Delete, Edit, Lock, FolderRemove } from '@element-plus/icons-vue'
import { MAX_TITLE_LENGTH } from '@/config/constants.js'

export default {
  name: 'ChatItem',
  components: {
    ChatRound,
    Delete,
    Edit,
    Lock,
    FolderRemove
  },
  props: {
    chat: {
      type: Object,
      required: true
    },
    active: {
      type: Boolean,
      default: false
    }
  },
  emits: ['switch', 'delete', 'update-title', 'archive'],
  data() {
    return {
      isEditing: false,
      editTitle: '',
      escapePressed: false
    }
  },
  computed: {
    isProtected() {
      return Boolean(this.chat?.protection?.enabled)
    }
  },
  methods: {
    confirmDelete() {
      this.$confirm('确定删除该对话吗？', '确认删除', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        closeOnClickModal: false
      })
        .then(() => {
          this.$emit('delete', this.chat.id)
        })
        .catch(() => {
          // 用户取消删除，不做处理
        })
    },
    startEditing() {
      this.editTitle = this.chat.title;
      this.isEditing = true;
    },
    cancelEditing() {
      // Esc 取消：置标志位后退出编辑，避免 input 卸载触发 blur 再走 saveTitle
      this.escapePressed = true;
      this.isEditing = false;
    },
    saveTitle() {
      if (this.escapePressed) {
        this.escapePressed = false;
        return;
      }
      const trimmedTitle = this.editTitle.trim();
      if (trimmedTitle === '') {
        this.$message({
          message: '标题不能为空',
          type: 'warning',
          duration: 2000
        });
        this.editTitle = this.chat.title;
      } else {
        let newTitle = trimmedTitle;
        // 限制标题长度为 MAX_TITLE_LENGTH
        if (newTitle.length > MAX_TITLE_LENGTH) {
          newTitle = newTitle.slice(0, MAX_TITLE_LENGTH);
        }
        if (newTitle !== this.chat.title) {
          this.$emit('update-title', { id: this.chat.id, title: newTitle });
        }
      }
      this.isEditing = false;
    },
    handleSwitch() {
      // 编辑中不切换，避免误触
      if (!this.isEditing) {
        this.$emit('switch', this.chat.id);
      }
    }
  }
}
</script> 

<style scoped>
.chat-item-title {
	white-space: normal;
	word-break: break-all;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
